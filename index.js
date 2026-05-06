const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SECATE);
const crypto = require("crypto");
console.log(process.env.STRIPE_SECATE);
const app = express();
app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded info:", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorize access" });
  }
};

const uri =
  "mongodb+srv://assingment-11:2nZFbx8h_BssrPz@cluster0.qmqsv1k.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    // Send a ping to confirm a successful connection
    const database = client.db("assingment11");
    const usersCollection = database.collection("users");
    const requestCollection = database.collection("request");
    const paymentsCollection = database.collection("payments");
    // user create api
    app.post("/user", async (req, res) => {
      const userInfo = req.body;
      userInfo.createdAt = new Date();
      userInfo.role = "donor";
      userInfo.status = "active";
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // All User
    app.get("/users", verifyFBToken, async (req, res) => {
      const size = Number(req.query.size);
      const page = Number(req.query.page);

      const result = await usersCollection
        .find()
        .limit(size)
        .skip(size * page)
        .toArray();

      const totaluser = await usersCollection.countDocuments();

      res.send({ user: result, totaluser });
    });

    app.get("/user/role/:email", async (req, res) => {
      const { email } = req.params;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    // status change api
    app.patch("/update/user/status", verifyFBToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { email: email };

      const updateStatus = {
        $set: {
          status: status,
        },
      };
      const result = await usersCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // role change
    app.patch("/update/role", verifyFBToken, async (req, res) => {
      const { email, role } = req.query;

      const query = { email };
      const updateRole = {
        $set: {
          role: role,
        },
      };

      const result = await usersCollection.updateOne(query, updateRole);
      res.send(result);
    });

    // Request
    app.post("/requests", verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await requestsCollection.insertOne(data);
      res.send(result);
    });

    // My Request
    app.get("/my-request", verifyFBToken, async (req, res) => {
      const email = req.decoded_email;
      const page = Number(req.query.page);
      const size = Number(req.query.size);
      const status = req.query.status;

      let query = { requesterEmail: email };

      if (status) {
        query.donationStatus = status;
      }

      const result = await requestCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      const totalRequest = await requestCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });

    // All Request
    app.get("/all-request", verifyFBToken, async (req, res) => {
      const size = Number(req.query.size);
      const page = Number(req.query.page);
      const status = req.query.status;

      let query = {};
      if (status) {
        query.donationStatus = status;
      }

      const result = await requestCollection
        .find(query)
        .limit(size)
        .skip(size * page)
        .toArray();

      const totalRequest = await requestCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });

    // Recent Request
    app.get("/recent-request", verifyFBToken, async (req, res) => {
      const result = await requestCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    // delete request
    app.delete("/Delete-request", verifyFBToken, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    // view request
    app.get("/Dashboard/view-request/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.findOne(query);
      res.send(result);
    });

    // Done Request
    app.patch("/done-request", verifyFBToken, async (req, res) => {
      const { id, status } = req.query;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          donationStatus: status,
        },
      };
      const result = await requestCollection.updateOne(query, update);
      res.send(result);
    });

    // Canceled Request
    app.patch("/cancel-request", verifyFBToken, async (req, res) => {
      const { id, status } = req.query;
      console.log(id, status);
      const query = { _id: new ObjectId(id) };

      const update = {
        $set: {
          donationStatus: status,
        },
      };
      const result = await requestCollection.updateOne(query, update);
      res.send(result);
    });

    // Donation Request
    app.get("/donation-page", async (req, res) => {
      const query = { donation_status: "pending" };
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    // Donation Details
    app.get("/donation-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.findOne(query);
      res.send(result);
    });

    // Donate
    app.patch("/donate", verifyFBToken, async (req, res) => {
      const { status, id } = req.query;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          donationStatus: status,
        },
      };
      const result = await requestCollection.updateOne(query, update);
      res.send(result);
    });

    // Search
    app.get("/search-requests", async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;

      const query = {};
      if (!query) {
        return;
      }
      if (bloodGroup) {
        query.bloodGroup = bloodGroup.replace(/ /g, "+").trim();
      }
      if (district && district !== "Chose Your District") {
        query.district = district;
      }
      if (upazila && upazila !== "Chose Your Upazila") {
        query.upazila = upazila;
      }
      console.log(query);
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    // payment
    app.post("/create-payment-checkout", async (req, res) => {
      const information = req.body;
      const amount = parseInt(information.donateAmount) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: "please donate",
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          donorName: information?.donorName,
        },
        customer_email: information.donorEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    app.post("/success-payment", async (req, res) => {
      const { session_id } = req.query;
      const session = await stripe.checkout.sessions.retrieve(session_id);
      console.log(session);

      const transactionId = session.payment_intent;

      const isPaymentExist = await paymentsCollection.findOne({
        transactionId,
      });

      if (isPaymentExist) {
        return;
      }

      if (session.payment_status == "paid") {
        const paymentInfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          donorEmail: session.customer_email,
          donorName: session.metadata.donorName,
          transactionId,
          payment_status: session.payment_status,
          paidAt: new Date(),
        };
        console.log(paymentInfo);
        const result = await paymentsCollection.insertOne(paymentInfo);
        return res.send(result);
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello, Sahine");
});

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
