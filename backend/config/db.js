const mongoose = require('mongoose')

/**
 * Index builds are silent by default, including when they fail.
 *
 * Mongoose builds declared indexes on connect and reports a failure by
 * emitting on the model, which nobody was listening to. That matters most for
 * the unique one on (user, date): if it cannot be built — duplicates already
 * in the collection, say — the guarantee simply is not there and the app
 * carries on as though it were.
 */
const reportIndexFailures = () => {
  for (const name of mongoose.modelNames()) {
    mongoose.model(name).on('index', (err) => {
      if (err) console.error(`Index build failed on ${name}: ${err.message}`)
    })
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    console.log(`MongoDB connected: ${conn.connection.host}`)
    reportIndexFailures()
  } catch (error) {
    console.error(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
