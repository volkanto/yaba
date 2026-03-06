# Yaba GitHub Pages Site

Static marketing/documentation page for Yaba.

## Local preview

```bash
cd website
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy

Deployment is handled by the GitHub Actions workflow at:

- `.github/workflows/deploy-github-pages.yml`

It publishes the contents of `website/` to GitHub Pages.
