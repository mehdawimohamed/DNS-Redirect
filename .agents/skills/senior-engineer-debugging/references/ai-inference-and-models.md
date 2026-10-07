# AI model inference (diffusers / PyTorch): image and video generation

The failures here rarely look like bugs in your code. They look like CUDA
errors, black frames, "the same prompt gives a different picture", or a
video that plays too fast. Each has a small number of real causes; the
discipline is to find which one with a probe, not to tune parameters until
the output looks right.

**Before anything else, record the exact conditions**: model repo *and
revision*, `diffusers`/`torch`/`transformers` versions, GPU type and
memory, dtype, resolution, frame count, steps, seed, and every scheduler or
guidance setting. A generation bug that is not reproducible from these is
not yet a bug you can fix.

## `torch.cuda.OutOfMemoryError`

Memory failures have three distinct shapes; the fix depends on which:

1. **Fails at load time** - the weights do not fit. Fixes: lower precision
   (`torch_dtype=torch.bfloat16`), a quantized checkpoint (FP8/NF4/GGUF),
   `enable_model_cpu_offload()`, or a bigger GPU.
2. **Fails at the first denoising step** - activations for this resolution
   or frame count do not fit. Reduce resolution or frames first (cost grows
   with pixels and, for video, with frames), then offload.
3. **Fails at the very end, after all steps ran** - the **VAE decode** is
   the memory peak, especially for video. `pipe.vae.enable_tiling()` /
   `enable_slicing()` target exactly this and are the cheapest fix.

Read the message: it reports how much was already allocated versus
reserved. A large "reserved but unallocated" figure means fragmentation
(try `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`), not too little
memory.

Diagnose by measuring, not guessing:

```
torch.cuda.reset_peak_memory_stats()
# ... run one generation ...
print(torch.cuda.max_memory_allocated() / 1024**3, "GiB peak")
```

Things that make it worse and are easy to miss: **a second pipeline still
loaded** in the same process (for example both the image and edit models),
tensors held in a list across requests, and **concurrent requests on one
GPU** - two jobs that each fit alone may not fit together. Rule out
concurrency (`max_inputs`/concurrency setting of the host platform) before
concluding a model "needs" more VRAM.

`enable_model_cpu_offload()` only helps if the pipeline is then run as a
whole in its normal order, works on a single GPU, and must not be
combined with an earlier `pipe.to("cuda")` (sequential offload has the same
restriction). It trades speed for memory; if latency matters, quantization
or a larger GPU is usually the better fix.

→ `huggingface.co/docs/diffusers/optimization/memory`.

## Black images, NaNs, garbage output

**Black or all-noise frames** are almost always numeric: the model ran in
`float16` where it needs `bfloat16` (or a full-precision VAE), producing
NaN/inf that decode to black. Check in this order:

1. Does the checkpoint's model card specify a dtype? The large recent
   image and video models are published in `bfloat16`; forcing `float16`
   can overflow.
2. Are there NaNs in the latents? A one-line probe after the pipeline
   returns latents (`torch.isnan(latents).any()`) settles it in seconds.
3. Was a **safety checker** or a downstream filter replacing the image?
   Some pipelines return a blank image and a flag rather than raising -
   read the pipeline output object, not just `.images[0]`.
4. Is `bfloat16` supported on the GPU in use? Older GPUs emulate it slowly
   or not at all.

Fix the dtype at the source. Do not "fix" black output by retrying or by
post-processing the image.

## "Same seed, different image" and non-reproducible results

Reproducibility needs the same seed *and* the same generator setup, model
revision, library versions, dtype, resolution and scheduler. Common
breaks: a `torch.Generator` created on the wrong device (CPU vs CUDA
produce different noise), a global `torch.manual_seed` while the pipeline
receives no `generator`, a seed of `-1`/`None` that is resolved
differently in two places (record the *resolved* seed on the job), and
non-deterministic GPU kernels. Bit-exact equality across different GPU
models is not guaranteed; do not write a test that requires it. Compare
with a tolerance, or assert on structure (dimensions, non-black, frame
count) instead.

## Wrong-looking results that are really parameter mismatches

Model families have specific knobs that do not mean what the generic
diffusion vocabulary suggests. Read the model card before tuning:

- **Qwen-Image / Qwen-Image-Edit** (diffusers): guidance is driven by
  `true_cfg_scale` (the repo examples use around 4.0) together with a
  `negative_prompt` (even a single space); setting only `guidance_scale`
  does not do what you expect. Image editing is documented as unstable
  without prompt rewriting/enhancement, and the "2509" edit variant is the
  one that accepts multiple input images - passing a list to the original
  edit pipeline fails or is ignored.
- **Wan 2.x video**: `num_frames` follows a `4n+1` pattern (13, 17, 25, 33,
  81, 121 all appear in official examples; the video VAE compresses time 4x),
  so 80 or 100 frames gets rounded or rejected - verify against the
  pipeline you actually run. Default resolutions are 480p/720p with
  dimensions divisible by the model's patch/VAE factor; an arbitrary width
  or height is rounded or errors. Wan2.2 A14B examples export at 16 fps
  while the 5B hybrid model targets 24 fps: exporting with the wrong `fps`
  gives a video that plays too fast or too slow with nothing wrong in the
  frames.
- **Image-to-video / image-conditioned modes**: the input image is resized
  or cropped to the target resolution; a portrait input into a landscape
  target crops the subject out. Match aspect ratio first, then judge the
  model.
- **Step/guidance defaults differ by variant**: distilled or "lightning"
  LoRAs expect very few steps and low or no guidance; using them with
  default 40-50 steps and high guidance burns the image.

## Slow generation and cold starts

Time a generation in stages before optimizing anything: model load,
text-encoder, denoising loop, VAE decode, encode-to-mp4, upload. In a
serverless GPU setting the largest cost is very often **loading weights on
every cold start** or, worse, **inside the request handler** (each request
re-downloads or re-loads a multi-GB model). Load once per container in a
startup hook and reuse; keep weights on a persistent volume rather than
downloading from the hub per container. `torch.compile` speeds up
steady state but adds a long first-call compile - measure the cold path
separately from the warm path.

## Version drift and missing pieces

- A pipeline class that exists on `diffusers` `main` but not in the pinned
  release (or a checkpoint whose `model_index.json` names a class your
  version lacks) produces an import or `from_pretrained` error - pin
  `diffusers`, `transformers` and `torch` together and change them
  together, never one at a time in a debugging session.
- Gated or renamed Hugging Face repos fail with 401/404 at download time;
  check the token and the exact repo id, and prefer baking weights into a
  volume so a hub outage does not become your outage.
- `safetensors` shards missing after an interrupted download load partially
  or fail obscurely - compare the file list and sizes to the repo.
