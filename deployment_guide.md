# 🚀 MessMate Deployment Guide

Follow these steps to take MessMate live.

## 1. 🥭 Setup MongoDB Atlas (Database)
You mentioned you have an account but use Compass. You need a **Cloud Connection String**.
1.  Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  Create a **Free Cluster** (M0).
3.  Go to **Network Access** → Add IP Address → **Allow Access from Anywhere (0.0.0.0/0)** (Required for Render).
4.  Go to **Database Access** → Create a user with a password.
5.  Go to **Database** → **Connect** → **Drivers** → Copy the `SRV` connection string.
    - It looks like: `mongodb+srv://<user>:<password>@cluster.xyz.mongodb.net/messmate?retryWrites=true&w=majority`

---

## 2. 🔌 Deploy Backend (Render.com)
1.  Push your `mmbackend` folder to a **GitHub Repository**.
2.  Log in to [Render.com](https://render.com/).
3.  Click **New** → **Web Service** → Connect your Repo.
4.  **Runtime**: `Node`
5.  **Build Command**: `npm install`
6.  **Start Command**: `npm start`
7.  **Environment Variables**:
    - `MONGO_URI`: (Your Atlas string from step 1)
    - `JWT_SECRET`: (Any random long string)
    - `FRONTEND_URL`: (Wait for Step 3 - you will put your Vercel URL here later)
8.  **Copy your Render URL**: (e.g., `https://messmate-api.onrender.com`)

---

## 3. 🎨 Deploy Frontend (Vercel)
1.  Push your `mmfrontend` folder to a **GitHub Repository**.
2.  Log in to [Vercel](https://vercel.com/).
3.  Click **Add New** → **Project** → Import your Repo.
4.  **Framework Preset**: `Vite`
5.  **Environment Variables**:
    - `VITE_API_URL`: `https://your-render-url.onrender.com/api` (The URL from Step 2)
6.  Click **Deploy**.
7.  **Copy your Vercel URL**: (e.g., `https://messmate.vercel.app`)

---

## 4. 🔗 Final Link (CORS)
Go back to your **Render Dashboard** and update the Environment Variable:
- `FRONTEND_URL`: `https://your-vercel-url.vercel.app`

---

## 📂 Handling Images (Important!)
Since Render has an "ephemeral" filesystem, images uploaded directly to the server will disappear whenever the server restarts or you redeploy.
- **For this MVP**: It works, but images might reset.
- **Future Fix**: We can update the app to use **Cloudinary** so images are stored permanently in the cloud.

---

**You're all set! Send me a message if you hit any roadblocks during these steps!** 🚀
