# Security by default

The theme underneath every rule here is the same: when something can't be
verified, the safe failure is to deny or refuse to start, never to quietly
proceed. Every example below is a real pattern, not a hypothetical -
"fail open" bugs like these are usually invisible until someone finds them
on purpose.

## Authorization is deny-by-default, not opt-in

Register the authentication/authorization check globally, so every route is
protected unless it's explicitly marked public - not the reverse, where
each new controller has to remember to add its own guard. The reverse
pattern fails silently: a controller that forgets the guard isn't broken in
an obvious way, it just quietly has no protection, and nothing points that
out until someone finds it.

**The fail-open shape to watch for**, even when it looks like it's doing
the right thing:
```
if (token) {
  try {
    request.user = verify(token);
  } catch {
    if (!isPublic) throw new UnauthorizedException();
    // no token, and the route is NOT public: falls through here
    // with no user set, and nothing throws.
  }
}
if (isPublic) return true;
if (!request.user) throw new UnauthorizedException(); // the only real gate
```
This can look like it works in every test that sends a token, because the
"no token at all" path only gets exercised by a specific, easy-to-forget
test case. Write that test explicitly: hit every protected route with no
credentials at all and assert it's rejected, not just the "wrong role"
case.

## Never hardcode a secret, key, or token - including as a fallback

**The exact bug shape to ban, everywhere, including scripts and tests**:
```
const secret = process.env.JWT_SECRET || 'some-literal-value';
```
The moment a real secret is ever assigned to a literal like this - even
temporarily, even in a test helper - it is compromised the instant that
code is committed, logged, or pasted anywhere. If a required secret is
missing, the application should refuse to start, with a clear error, at
boot time - not fall back to a value that works but shouldn't exist. This
also means: validate required configuration once, at startup, rather than
re-deriving a "sensible default" at the point of use.

## Input validation and output handling at every boundary

- Validate every request body against a schema or typed DTO at the
  boundary, not deep inside a service function after other things have
  already happened with the unvalidated data.
- Never build a query by concatenating untrusted input into it. Use
  parameterized queries or the query builder's own placeholder mechanism
  for every value, including identifiers where possible.
- Encode or escape output for the context it's rendered in (HTML, SQL,
  shell, log line) - the same untrusted string is dangerous differently in
  each of those contexts.

## Least privilege

A component that only needs to read shouldn't hold write credentials. An
admin tool or internal dashboard should not write directly to
money-affecting tables; it should call the same audited service layer the
rest of the application uses, so every write goes through the same
validation, ledger entries, and logging - not around it.

## Sensitive data: hash what you compare, encrypt what you display

If a value is only ever compared (a password, a one-time code, an API key),
hash it and compare hashes; there's no legitimate reason to ever need the
original back. If a value must sometimes be shown again in its original
form (an uploaded document, an account number a user needs to see),
encrypt it at rest and control who can decrypt it, and log every access.
Don't store either kind of value in plain, readable form "for now."

## Rate limiting on anything low-trust can trigger

Anything an anonymous or newly-created account can call repeatedly - login
attempts, one-time-code requests, search, file uploads, password resets -
needs a rate limit per identity and per source, or it becomes a way to run
up your bill, guess a code, or degrade the service for everyone else.

## Never log or echo back a secret

Redact tokens, passwords, one-time codes, API keys, and full account or
identity numbers from every log line, error message, and any report you
generate about the system - including in the course of debugging or
demonstrating that something works. A log line proving a token was issued
should never contain the whole token.
