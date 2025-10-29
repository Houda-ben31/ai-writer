const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
 const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
 app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ====== الإعدادات ======
const {
  PORT = 3000,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GEMINI_API_KEY,
  NODE_ENV
} = process.env;
 
app.use(cors({
  origin: [
    'https://www.bestsitesfor.com',
    'capacitor://localhost',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://www.seoanalyzertool.online',
    'https://ai-writer-sgka.onrender.com',
    'http://localhost:5500'
  ],
  credentials: true,
}));

// ===============================
// 1️⃣ حالة تسجيل الدخول
// ===============================
app.get('/auth/status', (req, res) => {
  const token = req.cookies.blogger_token;
  res.json({ loggedIn: !!token });
});

// ===============================
// 2️⃣ بدء OAuth
// ===============================
app.get('/auth', (req, res) => {
  const scope = encodeURIComponent('https://www.googleapis.com/auth/blogger');
  
  // ✅ إذا جاء redirect من العميل استخدمه
  const redirectAfter = req.query.redirect || req.get('Referer') || '/index.html';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code
    &client_id=${GOOGLE_CLIENT_ID}
    &redirect_uri=${GOOGLE_REDIRECT_URI}
    &scope=${scope}
    &access_type=offline
    &prompt=consent
    &state=${encodeURIComponent(redirectAfter)}`.replace(/\s+/g, '');

  console.log('🔁 redirect_uri المُرسل هو:', GOOGLE_REDIRECT_URI);
  res.redirect(authUrl);
});
 
// ===============================
// 3️⃣ استلام رمز التفويض
// ===============================
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const redirectAfter = req.query.state || '/index.html';

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

    // صفحة نجاح مؤقتة
    res.send(`
      <html>
        <head><meta charset="UTF-8"><title>تم تسجيل الدخول</title></head>
        <body>
          <p>✅ تم تسجيل الدخول بنجاح! سيتم تحويلك الآن...</p>
          <script>
            // حفظ العودة للجلسة
            sessionStorage.setItem('returnFromAuth', 'true');
            // إعادة التوجيه إلى الصفحة الأصلية
            setTimeout(() => window.location.href = '${redirectAfter}', 1500);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ خطأ في تبادل الرمز:', error.response?.data || error.message);
    res.status(500).send('فشل في تسجيل الدخول إلى Google');
  }
});

// ===============================
// 4️⃣ جلب المدونات
// ===============================
app.get('/blogs', async (req, res) => {
  const token = req.cookies.blogger_token;
  if (!token) return res.status(401).json({ error: '❌ غير مصرح. قم بتسجيل الدخول أولًا.' });

  try {
    const blogsRes = await axios.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const blogs = blogsRes.data.items?.map(blog => ({
      id: blog.id,
      name: blog.name,
    })) || [];

    res.json({ blogs });

  } catch (err) {
    console.error('❌ خطأ في جلب المدونات:', err.response?.data || err.message);
    res.status(500).json({ error: 'فشل في جلب المدونات' });
  }
});

// ===============================
// 5️⃣ نشر مقال إلى Blogger
// ===============================
app.post('/publish', async (req, res) => {
  try {
    const { title, content, blogId } = req.body;
    const token = req.cookies.blogger_token;

    if (!token) return res.status(401).json({ error: '❌ غير مصرح. قم بتسجيل الدخول أولًا.' });
    if (!blogId) return res.status(400).json({ error: '❌ لم يتم تحديد مدونة للنشر' });

    const postRes = await axios.post(
      `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`,
      { title, content },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.json({ url: postRes.data.url });

  } catch (err) {
    console.error('❌ خطأ في النشر:', err.response?.data || err.message);
    return res.status(500).json({ error: 'فشل في النشر إلى Blogger' });
  }
});

// ===============================
// 6️⃣ نشر مقال إلى WordPress
// ===============================
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

// ===============================
// 7️⃣ توليد المقال وإعادة صياغته
// ===============================
app.post('/generate-article', async (req, res) => {
  const { topic, language = 'ar' } = req.body;

  const prompt =
    language === 'en'
      ? `Write a high-quality blog article in English about: ${topic}. Do not include a sources section.`
      : `اكتب مقالة عربية عالية الجودة حول: ${topic}. لا تضف قسم المصادر.`;

   try {
    // 🟢 توليد المحتوى الأساسي
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const rawText = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم توليد محتوى.';
    const title = rawText.split('\n')[0].replace(/^#+/, '').trim();

    // 🟡 إعادة الصياغة
    const rephrasePrompt =
      language === 'en'
        ? `Paraphrase the following blog article to make it unique, human-like, and SEO-optimized:\n\n${rawText}`
        : `أعد صياغة المقال التالي بأسلوب حصري وطبيعي ومتوافق مع معايير السيو:\n\n${rawText}`;

    const paraphrasedRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: rephrasePrompt }] }] }
    );

    const finalText = paraphrasedRes.data.candidates?.[0]?.content?.parts?.[0]?.text || rawText;
    res.json({ title, content: finalText });

  } catch (error) {
    console.error('❌ خطأ في توليد أو إعادة صياغة المقال:', error.response?.data || error.message);
    res.status(500).json({ error: 'فشل في توليد المقال' });
  }
});

// ===============================
// 8️⃣ ملفات Static
// ===============================
app.use(express.static(path.join(__dirname, 'public')));

// ✅ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${PORT}`);
});
