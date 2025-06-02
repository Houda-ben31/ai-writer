const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

dotenv.config();
// إعداد Firebase Admin
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}


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
  origin: ['https://bestsitesfor.com', 'capacitor://localhost',     'http://127.0.0.1:5500', 'http://localhost:5500' , 'http://localhost:3000'],
  credentials: true,
}));

 // ✅ حالة الدخول
app.get('/auth/status', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '❌ يجب تسجيل الدخول باستخدام Firebase' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let uid;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (err) {
    return res.status(401).json({ error: '❌ رمز الدخول غير صالح' });
  }

  // ✅ التحقق من الخطة من Firestore
  try {
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    const userData = userDoc.data();

    if (userData?.plan !== 'premium') {
      return res.status(403).json({ error: '❌ هذه الميزة متاحة فقط للمشتركين المدفوعين' });
    }
  } catch (err) {
    return res.status(500).json({ error: '❌ حدث خطأ أثناء التحقق من الخطة' });
  }

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

app.get('/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  });
});

app.post('/api/verify-subscription', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '❌ لم يتم توفير رمز الدخول' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  let uid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (err) {
    return res.status(401).json({ success: false, error: '❌ رمز الدخول غير صالح' });
  }

  const { subscriptionID } = req.body;
  if (!subscriptionID) {
    return res.status(400).json({ success: false, error: '❌ معرف الاشتراك غير موجود' });
  }

  try {
    // استعلام إلى PayPal API
    const paypalRes = await axios.get(`https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionID}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    const status = paypalRes.data.status;
    if (status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: '❌ الاشتراك غير نشط' });
    }

    // ✅ تحديث خطة المستخدم إلى "premium"
    await admin.firestore().doc(`users/${uid}`).set({
      plan: 'premium',
      subscriptionID,
      subscribedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({ success: true });

  } catch (error) {
    console.error('❌ فشل التحقق من اشتراك PayPal:', error.response?.data || error.message);
    return res.status(500).json({ success: false, error: '❌ فشل في التحقق من اشتراك PayPal' });
  }
});

// ✅ بدء الخادم
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${PORT}`);
});
