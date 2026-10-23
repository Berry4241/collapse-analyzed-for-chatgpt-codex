# Publishing this extension on GitHub

## Prepare

- Confirm your rights to publish the code and icons.
- Review `LICENSE`; choose a different license if MIT is not what you intend.
- Review README and PRIVACY.md for accuracy.
- Never upload browser profiles, private chats, `.env` files, passwords, cookies, or keys.

## Upload using GitHub's website (no Git commands required)

1. Sign in and visit https://github.com/new.
2. Repository name: `collapse-analyzed-for-chatgpt-codex`
3. Description: `One-click, lightweight collapse-only extension for Analyzed panels in ChatGPT & Codex.`
4. Visibility: **Public**.
5. Do **not** auto-add a README, license or .gitignore: this source folder already includes them.
6. Click **Create repository**.
7. On the empty repository page, choose **uploading an existing file** (or **Add file → Upload files**).
8. Extract the GitHub source archive, open the extracted folder, and upload its **contents** (not the ZIP itself). Keep the `icons/`, `tests/`, `scripts/`, and `.github/workflows/` paths.
9. Commit with the message `Initial public release v1.6.0`.

Note: if GitHub's website does not preserve a hidden `.github` folder via drag and drop, use GitHub Desktop or Git to push the entire folder, or add the workflow file separately.

## Alternative: Git command line (Windows PowerShell or Git Bash)

Create an **empty public** GitHub repository first; replace `YOUR_USERNAME` in the command below.

```bash
cd path/to/collapse-analyzed-for-chatgpt-codex-github
git init
git branch -M main
git add .
git commit -m "Initial public release v1.6.0"
git remote add origin https://github.com/YOUR_USERNAME/collapse-analyzed-for-chatgpt-codex.git
git push -u origin main
```

Authentication may be requested by GitHub or Git Credential Manager.

## Publish an installable GitHub Release

1. Run `python scripts/package_release.py` locally, or use the accompanying release ZIP.
2. On the repository, open **Releases → Draft a new release**.
3. Create the tag `v1.6.0`; title it `v1.6.0 – Public Preview`.
4. Mark the release as **pre-release** while live-UI validation is ongoing.
5. Upload `collapse-analyzed-for-chatgpt-codex-v1.6.0.zip` as a release asset.
6. Publish the release.

Instruct users to download the release asset, **extract it**, then use `chrome://extensions` → Developer mode → Load unpacked.

Publishing on GitHub does **not** publish an extension to the Chrome Web Store.
