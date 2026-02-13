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
    const participated = battleEye.collection("participated");

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
      try {
        const paymentInfo = req.body;

        console.log("Received Payment Info:", paymentInfo);

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: String(paymentInfo.name),
                  description: String(paymentInfo.mode),
                  images: [String(paymentInfo.image)],
                },
                unit_amount: Number(paymentInfo.entryFee) * 100,
              },
              quantity: 1,
            },
          ],
          customer_email: String(paymentInfo.buyerMail),
          mode: "payment",

          metadata: {
            contestName: String(paymentInfo.name),
            contestId: String(paymentInfo.contestId),
            buyerMail: String(paymentInfo.buyerMail),
            buyerName: String(paymentInfo.buyerName),
            owner: String(paymentInfo.owner),
            image: String(paymentInfo.image),
          },

          success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/details/${paymentInfo.contestId}`,
        });

        console.log("Stripe session created:", session.id);

        res.send({ url: session.url });
      } catch (error) {
        console.log("Stripe ERROR:", error); //THIS WILL SHOW REAL ERROR
        res.status(500).send({ error: error.message });
      }
    });

    // sending the session id

    app.post("/payment-success", async (req, res) => {
      const { sessionId } = req.body;
      //   console.log(sessionId);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const contestData = await contest.findOne({
        _id: new ObjectId(session.metadata.contestId),
      });
      console.log(session);

      if (session.status === "complete" && contestData) {
        const existingOrder = await participated.findOne({
          transactionId: session.payment_intent,
        });

        if (existingOrder) {
          return res.send({ message: "Order already saved" });
        }

        const oderInfo = {
          contestId: session.metadata.contestId,
          transactionId: session.payment_intent,
          paid: session.amount_total,
          image: session.metadata.image,
          name: session.metadata.buyerName,
          owner: session.metadata.owner,
          contestName: session.metadata.contestName,
          buyerMail: session.metadata.buyerMail,
          time: new Date(session.created * 1000),
        };
        const result = await participated.insertOne(oderInfo);
        await contest.updateOne(
          {
            _id: new ObjectId(session.metadata.contestId),
          },
          { $inc: { participants: 1 } },
        );
      }
    });
    app.get("/dashboard/participated-contests/:email", async (req, res) => {
      const email = req.params.email;
      const result = await participated.find({ buyerMail: email }).toArray();
      res.send(result);
    });
    app.get("/dashboard/manage-contests/:email", async (req, res) => {
      const email = req.params.email;
      const result = await contest.find({ email: email }).toArray();
      res.send(result);
    });
    app.patch("/update/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const quarry = await contest.findOne({ _id: new ObjectId(id) });
      const result = await contest.updateOne(quarry, { $set: updatedData });
      res.send(result);
    });
    app.delete("/delete-contest/:id", async (req, res) => {
      const id = req.params.id;

      const result = await contest.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount > 0) {
        res.send({ success: true, message: "Contest deleted successfully" });
      } else {
        res.send({ success: false, message: "Contest not found" });
      }
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
