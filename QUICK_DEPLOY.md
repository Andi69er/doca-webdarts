# ⚡ Schnellstart: Deployment in 3 Schritten

## 1️⃣ Code zu GitHub pushen

Falls du noch kein Git-Repository hast:

```bash
cd "C:\Users\andre\OneDrive\Desktop\DOCA LETZTVERSION\neues projekt"
git init
git add .
git commit -m "DOCA Online Dart - Ready for deployment"
```

Dann auf GitHub hochladen:
- Erstelle ein neues Repository auf GitHub
- Verbinde es mit deinem lokalen Repository:
```bash
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
git branch -M main
git push -u origin main
```

## 2️⃣ Auf Render deployen

1. **Gehe zu**: https://render.com
2. **Klicke**: "New +" → "Web Service"
3. **Verbinde**: Dein GitHub Repository
4. **Render erkennt automatisch**: Die `render.yaml` Datei
5. **Klicke**: "Create Web Service"
6. **Warte**: 5-10 Minuten für das Deployment

## 3️⃣ Fertig! 🎉

Nach dem Deployment bekommst du eine URL wie:
`https://doca-webdarts.onrender.com`

Die Anwendung ist dann live und einsatzbereit!

---

## 💡 Tipp

Falls Render die `render.yaml` nicht automatisch erkennt:
- **Build Command**: `cd backend && npm install && cd ../frontend && npm install && npm run build`
- **Start Command**: `cd backend && node index.js`
- **Environment**: `Node`


