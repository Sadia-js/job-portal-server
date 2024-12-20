require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const logger = (req, res, next) => {
  console.log('inside the logger');
  next()
}

const verifyToken = (req, res, next) => {
  // console.log(req?.cookies)
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorizes access'})
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: "Unauthorized Access"})
    }
    req.user = decoded;
    // console.log(req.user)
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hnbxf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const jobsCollection = client.db("jobsPort").collection("jobs");
    const jobApplicationCollection = client.db("jobsPort").collection("job_applications");

    // auth related apis
    app.post('/jwt', (req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {expiresIn: '5h'});
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false
      })
      .send({success: true})
    })

    // job related apis
    app.get("/jobs",logger, async (req, res) => {
      console.log('now inside the api callback')
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    })

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    })

    // app.get('/job-applications/jobs/:job_id)=> get a specific job application by id
    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result)
    })

    app.patch("/job-applications/:id", async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $set: {
          status: data.status
        }
      }
      const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // job application apis
    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);
      // not the best way
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      }
      else {
        newCount = 1;
      }
      // update the job info
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: newCount
        }
      }
      const updatedResult = await jobsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    // use get for one or some data[0, 1, some or many]
    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'Forbidden'})
      }
      const result = await jobApplicationCollection.find(query).toArray();
      for (const application of result) {
        console.log(application.job_id);
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
          application.location = job.location;
        }
      }
      // console.log(result)
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Job is falling from the sky");
})

app.listen(port, () => {
  console.log(`Job is waiting at ${port}`);
})