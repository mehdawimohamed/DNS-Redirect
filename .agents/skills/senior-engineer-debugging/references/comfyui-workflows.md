# ComfyUI workflows and the ComfyUI API

ComfyUI is a workflow engine with an HTTP/WebSocket server around it. Most
"ComfyUI is broken" reports are one of: wrong JSON format, a model or node
the server does not have, a cached no-op, or a misread execution message.
Establish which before touching the workflow.

## Step zero: reproduce in the UI with the same server

Run the exact failing graph on the *same* ComfyUI install (same models
folder, same custom nodes, same version) through the UI. If it fails there,
it is a workflow/environment problem. If it works there but fails through
the API, it is a format, parameter-injection or input-upload problem. This
single comparison halves the search space.

## `400` from `/prompt`: "Prompt outputs failed validation"

`POST /prompt` validates the graph *before* queueing it and returns
`error` plus a `node_errors` object naming the node id and the field. Read
`node_errors` - the top-level message is generic. The recurring causes:

1. **`value_not_in_list`** - the workflow names a model, LoRA, VAE or
   sampler that is not in the server's list, e.g. `ckpt_name` or
   `unet_name` not in the available files. Widget dropdowns are populated
   from the files that actually exist on *that* server, so the filename in
   your JSON must match a file present in the right models sub-folder,
   character for character, and the file must be visible to the running
   process (see the volume note below). An empty list (`not in []`) means
   the folder is empty or unmounted, not that the name is wrong.
2. **`class_type` not found / missing node** - a custom node used by the
   workflow is not installed (or failed to import) in this environment.
   Check the server startup log for import failures; a node that silently
   failed to load is the same as a missing node.
3. **Submitted the UI format instead of the API format.** The saved
   workflow (with positions, groups, `nodes`/`links` arrays) is not what
   `/prompt` accepts. The API format is a flat object keyed by node id
   where each node is `{ "class_type": ..., "inputs": {...} }` and links
   are `[source_node_id, output_index]`. Export with "Save (API Format)"
   (or the equivalent export), and keep the API JSON as the versioned
   artifact your code loads.
4. **A `LoadImage` input that does not exist on the server.** The image
   must be uploaded first (`POST /upload/image`) and referenced by the
   returned filename; a path on your machine means nothing to the server.
5. **A link points at a node id that was removed or renumbered** after
   editing - re-export rather than hand-editing ids.

Validation errors are deterministic: they fail identically every time, so
retrying is never the fix. Classify the error, then fix the input.

## The prompt "succeeded" but there is no new output

ComfyUI caches results by node inputs. Submitting the same graph with the
same seed and inputs again can be served from cache (the server reports
`execution_cached` for those nodes), so no new file is produced and the
history entry may have no fresh outputs. If a job "finishes instantly with
nothing", check for this before suspecting a crash. In API-format JSON the
seed is a fixed number - the frontend's "randomize after run" behaviour
lives in the UI, not in the JSON - so a backend that does not inject a new
seed per job will hit the cache or produce identical images. Inject the
seed (and record it) on every submission.

## Reading execution messages correctly

Connect the WebSocket with the **same `client_id`** you passed to
`/prompt`; messages are routed by it, and a mismatch looks like "no
progress events at all".

- `execution_start` - the run began; `execution_cached` - these nodes were
  skipped because their inputs were unchanged.
- `executing` with a `node` id - that node is running. **`executing` with
  `node: null` means the whole prompt finished** - that is the completion
  signal, not the last `executed` message.
- `progress` - step/total for long nodes such as samplers.
- `executed` - only sent for nodes that return a UI output (for example
  SaveImage), *not* after every node. Do not use it to detect completion.
- `execution_error` - carries the failing node id, its type, and the Python
  exception and traceback; this is the message to log in full.

After completion, fetch results from `GET /history/{prompt_id}`: the
`outputs` map is keyed by node id, and each image/video entry has
`filename`, `subfolder` and `type`, which you pass to `GET /view`. Find
outputs by the id of the node you know produces them, not by "the first
entry" - a workflow with preview nodes has several.

If the socket drops mid-run, do not assume failure: the job may still be
running or finished. Poll `/history/{prompt_id}` before resubmitting, or
you will run (and pay for) the generation twice.

→ `docs.comfy.org/development/comfyui-server/comms_messages` and
`docs.comfy.org/development/api-development/workflow-api-format`.

## Out of memory and speed inside ComfyUI

Same three shapes as any diffusion run (load, sampling, VAE decode - see
`ai-inference-and-models.md`); in ComfyUI look at *which node* the
`execution_error` names. A VAE Decode failure suggests tiled decode; a
loader failure suggests a smaller/quantized checkpoint. Requests to
`/prompt` are queued and executed **one at a time per server**, so "slow
under load" is often queueing, not slow inference - measure queue wait
separately from run time. To run in parallel you need more GPUs/instances,
not more requests.

## ComfyUI on a serverless GPU platform (Modal and similar)

- **Model files not found on the deployed app but present in dev**: the
  models live on a persistent volume; confirm the volume is mounted at the
  path ComfyUI's model search paths expect, that the download step
  committed to it, and that the running container reloaded it. A container
  started before the files were committed will not see them until the
  volume is reloaded or a new container starts.
- **Custom nodes present locally, "missing node" in the deployed image**:
  they were installed by hand on the dev machine, not in the image build.
  Everything the graph needs must be installed by the image definition,
  pinned to a commit.
- **First request after idle takes minutes**: cold start = container start
  + ComfyUI boot + model load. Gate `/prompt` on the server's health
  endpoint responding, and measure cold versus warm separately.
- **Passing the wrong thing to a serverless wrapper**: the API-format graph
  and any input images must be passed as data (bytes/JSON), not local
  paths. Output files written inside the container disappear with it unless
  returned or written to a volume/object store.

## Parameter injection bugs (when your code edits the workflow JSON)

Backends usually load a template graph and set a few inputs (prompt, seed,
size, image). The failure modes are in the injection code: replacing a
value by *searching for a string* and hitting two nodes, writing to a node
id that changed after a workflow edit, injecting a value of the wrong type
(a numeric string into a numeric input), or leaving an old default in a
field nobody remembered. When output is "almost right but ignoring my
setting", dump the final JSON actually submitted and diff it against the
template - the answer is on the diff.
