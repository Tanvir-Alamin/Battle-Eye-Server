const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const port = 3000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@tanvircluster.9cveqw4.mongodb.net/?appName=TanvirCluster`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("hello world");
});

async function run() {
  try {
    await client.connect();
    const battleEye = client.db("BattleEye");
    const contest = battleEye.collection("Contest");

    app.get("/all-contests", async (req, res) => {
      const cursor = contest.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const result = await contest.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/all-contests", async (req, res) => {
      const contestData = req.body;
      const result = await contest.insertOne(contestData);
      res.send(result);
      console.log("added successful");
    });

    // Payment Option Stripe
    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.name,
                description: paymentInfo?.mode,
                image: [paymentInfo.image],
              },
              unit_amount: paymentInfo.entryFee * 100,
            },
          },
        ],
        customer_email: paymentInfo.buyerMail,
        mode: "payment",
        metadata: {
          contestId: paymentInfo?.contestId,
          buyer: paymentInfo.buyer,
        },
      });
    });

    await client.db("BattleEye").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}

run().catch(console.dir);
app.listen(port, () => {
  console.log(`server is running from outside mongo from port ${port}`);
});
