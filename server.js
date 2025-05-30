const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();

// إعدادات عامة
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ⚠️ تأكد أن الواجهة الأمامية داخل public
app.use(express.static(path.join(__dirname, 'public')));

// بيئة الخادم
const {
  PORT = 3000,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

// إعداد CORS - عدلي حسب موقعك النهائي
app.use(cors({
  origin: ['https://bestsitesfor.com', 'capacitor://localhost', 'http://localhost:5500'],
  credentials: true,
}));

 // ✅ حالة الدخول
app.get('/auth/status', (req, res) => {
  const token = req.cookies.blogger_token;
  res.json({ loggedIn: !!token });
});

// ✅ بدء OAuth
app.get('/auth', (req, res) => {
  const scope = encodeURIComponent('https://www.googleapis.com/auth/blogger');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(authUrl);
});

// ✅ استلام رمز التفويض
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('❌ لم يتم توفير رمز التفويض');

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      },
    });

    const accessToken = response.data.access_token;
    if (!accessToken) throw new Error('❌ فشل في الحصول على رمز الوصول');

    res.cookie('blogger_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 3600 * 1000,
    });

    // ✅ أعيدي التوجيه إلى موقعك الحقيقي (ليس localhost)
    res.send(`
      <html>
        <head><meta charset="UTF-8"><title>تم تسجيل الدخول</title></head>
        <body>
          <p>✅ تم تسجيل الدخول بنجاح! سيتم تحويلك الآن...</p>
          <script>
            setTimeout(() => window.location.href = 'https://bestsitesfor.com', 1500);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ خطأ في تبادل الرمز:', error.response?.data || error.message);
    res.status(500).send('فشل في تسجيل الدخول إلى Google');
  }
});

// ✅ نشر مقال إلى Blogger
app.post('/publish', async (req, res) => {
  try {
    const { title, content } = req.body;
    const token = req.cookies.blogger_token;
    if (!token) return res.status(401).json({ error: '❌ غير مصرح. قم بتسجيل الدخول أولًا.' });

    const blogsRes = await axios.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const blogId = blogsRes.data.items?.[0]?.id;
    if (!blogId) return res.status(400).json({ error: '❌ لم يتم العثور على مدونة' });

    const postRes = await axios.post(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
      title,
      content,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.json({ url: postRes.data.url });

  } catch (err) {
    console.error('❌ خطأ في النشر:', err.response?.data || err.message);
    return res.status(500).json({ error: 'فشل في النشر إلى Blogger' });
  }
});


// ✅ نشر إلى WordPress
app.post('/publish-wordpress', async (req, res) => {
  const { url, username, password, title, content } = req.body;

  if (!url || !username || !password || !title || !content) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    const response = await axios.post(`${url}/wp-json/wp/v2/posts`, {
      title,
      content,
      status: 'publish',
    }, {
      auth: { username, password }
    });

    res.json({ url: response.data.link });
  } catch (error) {
    console.error('❌ خطأ في النشر إلى WordPress:', error.response?.data || error.message);
    res.status(500).json({ error: 'فشل في النشر إلى WordPress' });
  }
});


// ✅ بدء الخادم
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${PORT}`);
});
