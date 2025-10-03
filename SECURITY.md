# Security Policy

We take security seriously and appreciate responsible disclosures that help keep users safe.

## Supported Versions
The latest release (and the `main` branch) receive security updates. Older releases may not be patched; please upgrade to the most recent version.

## Reporting a Vulnerability
If you discover a vulnerability or potential security issue:

1. Do NOT open a public issue.
2. Email the maintainers (create a temporary issue titled "security-contact" if contact info is absent and we will respond privately) OR use GitHub Security Advisories if enabled.
3. Provide as much detail as possible:
   - Affected component (main process, preload bridge, renderer, packaging)
   - Steps to reproduce / proof of concept
   - Potential impact (data exposure, RCE, privilege escalation, etc.)
   - Suggested remediation if known

We aim to acknowledge valid reports within 3 business days and provide an initial remediation plan or timeline within 10 business days.

## Preferred Topics
We are especially interested in reports concerning:
- Bypass of API key encryption or leakage in plaintext
- IPC channel abuse / privilege escalation
- Unsandboxed remote content injection
- Markdown rendering XSS bypass
- Supply chain vulnerabilities (dependency issues)

## Out of Scope
- Self-XSS requiring user to paste malicious content into the app manually
- Denial-of-service via extremely large model responses (within reason)
- Lack of obfuscation (we do not attempt to hide source code)

## Handling & Disclosure Process
1. Report received and triaged.
2. If confirmed, a private security advisory draft may be opened for coordination.
3. Fix developed, reviewed, and tested.
4. Release published; users encouraged to upgrade.
5. Public disclosure (issue / release notes / advisory) with credit (if desired).

## Cryptography Notes
- API keys are encrypted using Electron `safeStorage`. This is OS keychain / DPAPI backed and may rely on the current OS user context.
- No custom cryptographic primitives are implemented.

## Hardening Guidelines Followed
- Context isolation and a minimal preload surface.
- Sanitized markdown rendering.
- No dynamic `eval` / remote code execution paths.
- Streaming network operations isolated to main process.

## Responsible Disclosure
Please act in good faith: avoid unnecessary data access, do not publicly disclose prior to fix release, and comply with applicable laws.

Thank you for helping keep the community safe.
