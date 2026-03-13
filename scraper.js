require("dotenv").config()

const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const cron = require("node-cron")

const sendAlert = require("./telegram")

const FILE = "trades.json"


function loadTrades() {

  if (!fs.existsSync(FILE)) {

    fs.writeFileSync(FILE, JSON.stringify([]))

  }

  return JSON.parse(fs.readFileSync(FILE))

}


function saveTrades(data) {

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2))

}


async function checkTrades() {

  console.log("Checking trades...")

  const url = "https://www.capitoltrades.com/trades"

  try {

    const { data } = await axios.get(url)

    const $ = cheerio.load(data)

    const savedTrades = loadTrades()

    $("tr").each(async (i, el) => {

      const name = $(el).text()

      if (!name) return

      const tradeID = name

      if (!savedTrades.includes(tradeID)) {

        savedTrades.push(tradeID)

        await sendAlert(`🚨 New Congressional Trade\n\n${name}`)

      }

    })

    saveTrades(savedTrades)

  } catch (error) {

    console.log("Error:", error.message)

  }

}


checkTrades()

cron.schedule("*/5 * * * *", () => {

  checkTrades()

})