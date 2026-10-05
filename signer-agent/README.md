# Fatura Signer

Signs ETA documents on the machine that holds the company's signing certificate. The private key
never leaves the token: Fatura sends the canonical document text, the agent builds the CAdES-BES
signature locally and returns it.

1. In Fatura: **Settings → Signing → Pair a signer**. Copy the token (shown once).
2. On the signing PC (Node 20+):
   ```bash
   npm run build:signer            # from the repo, produces signer-agent/dist/fatura-signer.mjs
   npm i pkcs11js                  # once, for USB tokens
   set FATURA_URL=https://your-fatura-host
   set FATURA_AGENT_TOKEN=fat_agent_…
   set PKCS11_LIB=C:\Windows\System32\eps2003csp11.dll   # your token vendor's PKCS#11 library
   set PKCS11_PIN=••••••
   node fatura-signer.mjs
   ```
3. Fatura shows **Signer online** in the top bar. Submissions now queue for the agent and validate
   within seconds of being signed.

For testing without a token use a software certificate: `SIGNER=pfx PFX_PATH=cert.p12 PFX_PASSWORD=…`.

Run it as a Windows service (e.g. with NSSM) so recurring invoices are signed unattended while the
token is plugged in.
