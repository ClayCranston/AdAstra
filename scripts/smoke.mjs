import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:3000";
async function login(profile) {
  const jar = new Map();
  function save(response) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  function cookie() {
    return [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  const csrf = await fetch(`${base}/api/auth/csrf`);
  save(csrf);
  const { csrfToken } = await csrf.json();
  const signed = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie(),
    },
    body: new URLSearchParams({
      csrfToken,
      profile,
      json: "true",
      callbackUrl: base,
    }),
    redirect: "manual",
  });
  save(signed);
  const session = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: cookie() },
  }).then((r) => r.json());
  assert.equal(session.user.id, profile);
  return cookie();
}
const anonymous = await fetch(`${base}/api/workspace`);
assert.equal(anonymous.status, 401);
const clay = await login("clay"),
  eames = await login("eames");
const state = await fetch(`${base}/api/workspace?org=original`, {
  headers: { Cookie: clay },
}).then((r) => r.json());
assert.equal(state.org.name, "original");
assert.equal(state.org.role, "owner");
assert.deepEqual(state.profiles.map((p) => p.name).sort(), ["Clay", "Eames"]);
assert.deepEqual(state.members.map((p) => p.name).sort(), ["Clay", "Eames"]);
const member = await fetch(`${base}/api/workspace?org=original`, {
  headers: { Cookie: eames },
}).then((r) => r.json());
assert.equal(member.org.role, "member");
assert.ok(member.goals.every((g) => g.user_id === "eames"));
const prohibited = await fetch(`${base}/api/workspace?org=not-a-member`, {
  headers: { Cookie: eames },
});
assert.equal(prohibited.status, 403);
const invalidOrigin = await fetch(`${base}/api/workspace`, {
  method: "POST",
  headers: {
    Cookie: clay,
    "Content-Type": "application/json",
    Origin: "https://untrusted.example",
  },
  body: JSON.stringify({
    action: "createOrg",
    name: "Should not exist",
    description: "",
  }),
});
assert.equal(invalidOrigin.status, 403);
const forbidden = await fetch(`${base}/api/workspace`, {
  method: "POST",
  headers: { Cookie: eames, "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    action: "createGroup",
    orgId: "original",
    name: "Should not exist",
    description: "",
  }),
});
assert.equal(forbidden.status, 403);
console.log(
  "HTTP smoke passed: local sessions, original roster, member scoping, 401/403 isolation, origin protection.",
);
