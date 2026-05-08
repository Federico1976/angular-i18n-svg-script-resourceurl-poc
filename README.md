# Angular i18n ResourceURL Injection via SVG `<script href>` Translation Boundary

## Summary

Disclosure status
Reported to Google OSS VRP.
Closed as duplicate.

This repository contains a private proof-of-concept for a security issue in Angular involving the interaction between:

- Angular i18n translated attributes;
- SVG namespace handling;
- SVG `<script>` elements;
- `href` / `xlink:href` script URL attributes;
- Resource URL / TrustedScriptURL security boundaries.

The issue was reported to Google OSS VRP and closed as a duplicate of an existing bug.

The core finding is that a safe static script URL in the Angular source template can be replaced through Angular localization data and reach an SVG script URL execution sink.

In the tested scenario, the original Angular template contains:

```html
<script
  id="svgScriptHref"
  i18n-href="@@svgScriptHrefUrl"
  href="/safe-empty.js">
</script>

but the localized value supplied through loadTranslations() changes the value to:

svgScriptHrefUrl: '/svg-script-payload.js'

The generated Angular bundle places the translated value into an SVG <script href> attribute, and the browser executes the translated script resource.

Tested environment
Angular CLI       : 21.2.10
Angular           : 21.2.12
Node.js           : 22.22.2
Package Manager   : npm 9.2.0
Operating System  : Linux x64

@angular/build            21.2.10
@angular/cli              21.2.10
@angular/common           21.2.12
@angular/compiler         21.2.12
@angular/compiler-cli     21.2.12
@angular/core             21.2.12
@angular/localize         21.2.12
@angular/platform-browser 21.2.12
typescript                5.9.3
Vulnerability class

This is not a normal developer-authored unsafe script URL.

The dangerous boundary is:

trusted Angular template
        ↓
safe static Resource URL
        ↓
i18n translated attribute
        ↓
localized replacement value
        ↓
SVG <script href> / <script xlink:href>
        ↓
browser script execution

The attacker-controlled primitive is the localization layer.

If an attacker can influence translation data, translation bundles, runtime loadTranslations() values, or a translation-management/CI pipeline, they may be able to replace a safe script URL with an attacker-controlled same-origin script URL.

Impact

In affected applications, compromise of the i18n/localization supply chain can become script execution in the Angular application origin.

Potential attacker positions:

malicious translator;
compromised translation management system;
compromised localization file in CI/CD;
poisoned i18n bundle;
malicious package or build step modifying translations;
untrusted tenant-controlled translation data in white-label/multilingual SaaS systems.

Potential impact:

same-origin JavaScript execution;
session/token theft depending on application storage model;
authenticated action execution;
DOM takeover;
CSP bypass in cases where the payload script is hosted from an allowed same-origin location;
escalation from “translation content control” to script execution.
Why this is security-sensitive

Angular normally treats script URLs as Resource URL / TrustedScriptURL-sensitive sinks.

For example, normal dangerous URL bindings are sanitized or blocked. In the source, Angular contains Resource URL protections such as:

ɵɵsanitizeResourceUrl()
ɵɵtrustConstantResourceUrl()

and security-sensitive schema entries such as:

script|href
script|xlink:href

However, the PoC shows that the i18n/static-attribute path for SVG script URL attributes can allow translated values to reach the generated constant attribute array without being converted through ɵɵtrustConstantResourceUrl() or rejected as a security-sensitive i18n attribute.

Relevant Angular source areas

Observed source areas:

packages/compiler/src/schema/dom_security_schema.ts
packages/compiler/src/schema/trusted_types_sinks.ts
packages/compiler/src/render3/view/i18n/meta.ts
packages/compiler/src/template/pipeline/src/phases/resolve_sanitizers.ts
packages/compiler/src/template/pipeline/src/phases/const_collection.ts
packages/core/src/sanitization/sanitization.ts

Important observations:

dom_security_schema.ts

Angular marks SVG script URLs as Resource URL contexts:

registerContext(SecurityContext.RESOURCE_URL, [
  ...
  'script|href',
  'script|xlink:href',
]);
trusted_types_sinks.ts

The Trusted Types sink list includes:

const TRUSTED_TYPES_SINKS = new Set<string>([
  'iframe|srcdoc',
  '*|innerhtml',
  '*|outerhtml',
  'embed|src',
  'iframe|src',
  'object|codebase',
  'object|data',
]);

but does not include:

script|href
script|xlink:href

This matters because Angular i18n attribute validation checks isTrustedTypesSink() before rejecting translated security-sensitive attributes.

meta.ts

The i18n attribute validation path checks:

isTrustedTypesSink(node.name, name)

and rejects attributes only if they match that Trusted Types sink list:

if (isTrustedType) {
  this._reportError(
    attr,
    `Translating attribute '${name}' is disallowed for security reasons.`,
  );
} else {
  attrsMeta[name] = attr.value;
}

This rejects known cases like:

<iframe srcdoc="..." i18n-srcdoc>
<object data="..." i18n-data>

but did not reject the SVG script cases tested here
