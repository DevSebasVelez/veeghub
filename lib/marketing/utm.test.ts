import assert from "node:assert/strict";
import { test } from "node:test";

import { buildUtmUrl, renderFirstComment, stripUtm } from "./utm";

test("buildUtmUrl arma source y medium por canal", () => {
  const url = buildUtmUrl({
    linkUrl: "https://veegsoft.com/industrias/manufactura",
    channel: "LINKEDIN_PERSONAL",
    campaignSlug: "industrias",
    postId: "abc123",
  });
  assert.equal(
    url,
    "https://veegsoft.com/industrias/manufactura?utm_source=linkedin&utm_medium=social&utm_campaign=industrias&utm_content=abc123",
  );

  const gbp = buildUtmUrl({
    linkUrl: "https://veegsoft.com/",
    channel: "GBP",
    campaignSlug: null,
  });
  assert.equal(
    gbp,
    "https://veegsoft.com/?utm_source=gbp&utm_medium=organic&utm_campaign=general",
  );
});

test("buildUtmUrl reemplaza UTM previos y conserva otros parámetros", () => {
  const url = buildUtmUrl({
    linkUrl: "https://veegsoft.com/x?ref=a&utm_source=old&utm_campaign=old#top",
    channel: "INSTAGRAM",
    campaignSlug: "serie",
    postId: "p1",
  });
  assert.equal(
    url,
    "https://veegsoft.com/x?ref=a&utm_source=instagram&utm_medium=social&utm_campaign=serie&utm_content=p1#top",
  );
});

test("buildUtmUrl devuelve null con URL vacía o inválida", () => {
  assert.equal(buildUtmUrl({ linkUrl: "", channel: "GBP" }), null);
  assert.equal(buildUtmUrl({ linkUrl: "veegsoft", channel: "GBP" }), null);
  assert.equal(buildUtmUrl({ linkUrl: "javascript:alert(1)", channel: "GBP" }), null);
});

test("stripUtm limpia sólo los utm_*", () => {
  assert.equal(
    stripUtm("https://veegsoft.com/a?utm_source=linkedin&utm_medium=social&x=1"),
    "https://veegsoft.com/a?x=1",
  );
});

test("renderFirstComment agrega el enlace en su propia línea", () => {
  assert.equal(renderFirstComment("Mira 👇", "https://a.com"), "Mira 👇\nhttps://a.com");
  assert.equal(renderFirstComment(null, "https://a.com"), "https://a.com");
  assert.equal(renderFirstComment("  ", null), null);
});
