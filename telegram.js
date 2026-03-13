require("dotenv").config()
const axios = require("axios")

async function sendAlert(message) {

  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`

  try {

    await axios.post(url, {
      chat_id: process.env.CHAT_ID,
      text: message
    })

  } catch (error) {

    console.log("Telegram error:", error.message)

  }

}

module.exports = sendAlert