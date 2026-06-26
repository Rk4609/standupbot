// const cloudinary = require('cloudinary').v2
// const { CloudinaryStorage } = require('multer-storage-cloudinary')
// const multer = require('multer')

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// })
// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'standupbot/avatars',
//     allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
//     transformation: [{ width: 200, height: 200, crop: 'fill' }]
//   }
// })



// const upload = multer({ storage })

// module.exports = { cloudinary, upload }

const cloudinary = require('cloudinary').v2
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Memory storage — file disk pe nahi, memory mein
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Sirf images allowed hain!'))
    }
  }
})

module.exports = { cloudinary, upload }