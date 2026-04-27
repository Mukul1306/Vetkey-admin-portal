require("dotenv").config();

const express = require("express");   // ✅ first
const app = express();               // ✅ then create app

const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

// ✅ middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://vetkeyadminportal.netlify.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ================= IMAGE UPLOAD =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

// ================= MODELS =================
const Employee = mongoose.model("Employee", {
  name: String,
  mobile: String,
  address: String,
  location: String,
  age: Number,
  gender: String,
  empId: String,
  lastDistributionDate: {
  type: Date,
  default: null
},
  password: String,
  status: { type: String, default: "active" },
  image: String
});

const Client = mongoose.model("Client", {
  name: String,
  mobile: String,
  location: String,
  employeeId: String,
  employeeName: String
});


// 💊 PRODUCT MODEL (NEW)
const Product = mongoose.model("Product", {
  name: String,
  quantity: Number,
  price: Number   // 💰 NEW FIELD
});

const Assign = mongoose.model("Assign", {
  employeeId: String,
  products: [
    {
      productId: String,
      name: String,
      quantity: Number
    }
  ],
  duration: String, // "20 days", "1 month"
  date: { type: Date, default: Date.now }
});


const Distribution = mongoose.model("Distribution", {
  employeeId: String,
  employeeName: String, // ✅ NEW
  doctorName: String,
  location: String,
  mobile: String,
  products: [
    {
      productId: String,
      name: String,     // ✅ IMPORTANT
      quantity: Number
    }
  ],
  date: { type: Date, default: Date.now }
});



const MonthlySale = mongoose.model("MonthlySale", {
  employeeId: String,
  employeeName: String,

  clientId: String,     // ✅ NEW
  clientName: String,   // ✅ NEW

  month: String,
  year: String,

  products: [
    {
      productId: String,
      name: String,
      quantity: Number,
      price: Number,
      total: Number
    }
  ],

  grandTotal: Number,
  date: { type: Date, default: Date.now }
});


// ================= ADMIN LOGIN =================
const ADMIN_ID = "vke0010";
const ADMIN_PASS = "RKSmsd120120@";

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { empId, password } = req.body;

  if (empId === ADMIN_ID && password === ADMIN_PASS) {
    return res.json({ role: "admin" });
  }

  const user = await Employee.findOne({ empId, password });

  if (!user) {
    return res.status(400).json({ msg: "Invalid credentials" });
  }

  if (user.status === "blocked") {
    return res.status(403).json({ msg: "User Blocked" });
  }

  if (user.status === "suspended") {
    return res.status(403).json({
      msg: "Your account is suspended. Please contact Mr. Rakesh Kumar Sharma."
    });
  }

  res.json({ role: "employee", user });
});

// ================= ADD EMPLOYEE =================
app.post("/add-employee", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;

      // 🧹 delete local file
      fs.unlinkSync(req.file.path);
    }

    const emp = new Employee({
      ...req.body,
      image: imageUrl
    });

    await emp.save();

    res.json(emp);

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    res.status(500).json({ msg: "Error saving employee" });
  }
});
// ================= GET EMPLOYEES =================
app.get("/employees", async (req, res) => {
  const data = await Employee.find();
  res.json(data);
});

// ================= DELETE EMPLOYEE =================
app.delete("/employee/:id", async (req, res) => {
  await Employee.findByIdAndDelete(req.params.id);
  res.json({ msg: "Deleted" });
});

// ================= STATUS CONTROL =================
app.put("/employee/suspend/:id", async (req, res) => {
  await Employee.findByIdAndUpdate(req.params.id, { status: "suspended" });
  res.json({ msg: "Suspended" });
});

app.put("/employee/block/:id", async (req, res) => {
  await Employee.findByIdAndUpdate(req.params.id, { status: "blocked" });
  res.json({ msg: "Blocked" });
});

app.put("/employee/unsuspend/:id", async (req, res) => {
  await Employee.findByIdAndUpdate(req.params.id, { status: "active" });
  res.json({ msg: "Unsuspended" });
});

app.put("/employee/unblock/:id", async (req, res) => {
  await Employee.findByIdAndUpdate(req.params.id, { status: "active" });
  res.json({ msg: "Unblocked" });
});

// ================= PRODUCT APIs (NEW 🔥) =================

// ➕ Add Product
app.post("/product", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: "Error adding product" });
  }
});

// 📦 Get All Products
app.get("/products", async (req, res) => {
  const data = await Product.find();
  res.json(data);
});

// ❌ Delete Product
app.delete("/product/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ msg: "Product Deleted" });
});


app.post("/assign", async (req, res) => {
  const assign = new Assign(req.body);
  await assign.save();
  res.json(assign);
});


app.get("/assign/:employeeId", async (req, res) => {
  const data = await Assign.find({ employeeId: req.params.employeeId });
  res.json(data);
});

app.get("/assign", async (req, res) => {
  try {
    const data = await Assign.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching assign data" });
  }
});

app.post("/distribute", async (req, res) => {
  try {
    const emp = await Employee.findById(req.body.employeeId);

    if (!emp) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    const cleanedProducts = req.body.products.map(p => ({
      ...p,
      quantity: Number(p.quantity)
    }));

    const data = new Distribution({
      ...req.body,
      employeeName: emp.name,
      products: cleanedProducts
    });

    await data.save();

    // 🔥 IMPORTANT: UPDATE LAST ACTIVITY
    await Employee.findByIdAndUpdate(req.body.employeeId, {
      lastDistributionDate: new Date(),
      status: "active" // auto activate if previously suspended
    });

    res.json(data);

  } catch (err) {
    console.log("DISTRIBUTE ERROR:", err);
    res.status(500).json({ msg: "Error distributing" });
  }
});

app.get("/distribution-report", async (req, res) => {
  const data = await Distribution.find();
  res.json(data);
});

app.delete("/distribution/:id", async (req, res) => {
  try {
    await Distribution.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting distribution" });
  }
});


app.delete("/assign/employee/:employeeId", async (req, res) => {
  try {
    await Assign.deleteMany({ employeeId: req.params.employeeId });
    res.json({ msg: "Stock cleared" });
  } catch (err) {
    res.status(500).json({ msg: "Error clearing stock" });
  }
});

app.put("/employee/:id", upload.single("image"), async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ msg: "Employee ID missing" });
    }

    const updateData = { ...req.body };

    // ✅ Clean strings
    for (let key in updateData) {
      if (typeof updateData[key] === "string") {
        updateData[key] = updateData[key].trim();
      }
    }

    // ❌ remove empty fields
    for (let key in updateData) {
      if (updateData[key] === "") {
        delete updateData[key];
      }
    }

    // ✅ convert age
    if (updateData.age) {
      updateData.age = Number(updateData.age);
    }

    // ✅ image
   if (req.file) {
  const result = await cloudinary.uploader.upload(req.file.path);
  updateData.image = result.secure_url;

  fs.unlinkSync(req.file.path);
}

    // ❌ remove empty password
    if (!updateData.password) {
      delete updateData.password;
    }

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    res.json({ msg: "Employee updated successfully", updated });

  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({ msg: "Error updating employee" });
  }
});


app.post("/monthly-sale", async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      clientId,
      clientName,
      month,
      year,
      products
    } = req.body;

    // ✅ VALIDATION
    if (!employeeId || !clientId || !month || !year) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({ msg: "No products added" });
    }

    let grandTotal = 0;

    const updatedProducts = products.map(p => {
      const qty = Number(p.quantity);
      const price = Number(p.price);

      const total = qty * price;
      grandTotal += total;

      return {
        productId: p.productId,
        name: p.name,
        quantity: qty,
        price: price,
        total
      };
    });

    const sale = new MonthlySale({
      employeeId,
      employeeName,
      clientId,
      clientName,
      month,
      year,
      products: updatedProducts,
      grandTotal
    });

    await sale.save();

    res.json({ msg: "Sale saved successfully", sale });

  } catch (err) {
    console.log("SALE ERROR:", err);
    res.status(500).json({ msg: "Error saving sale" });
  }
});

app.get("/monthly-sales", async (req, res) => {
  const data = await MonthlySale.find();
  res.json(data);
});

app.post("/client", async (req, res) => {
  const client = new Client(req.body);
  await client.save();
  res.json(client);
});

app.get("/clients", async (req, res) => {
  const data = await Client.find();
  res.json(data);
});

app.get("/monthly-sales/filter", async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (month) filter.month = month;
    if (year) filter.year = year;

    const data = await MonthlySale.find(filter);

    res.json(data);

  } catch (err) {
    res.status(500).json({ msg: "Error fetching filtered sales" });
  }
});

app.put("/distribution/:id", async (req, res) => {
  try {
    const updated = await Distribution.findByIdAndUpdate(
      req.params.id,
      {
        doctorName: req.body.doctorName,
        location: req.body.location,
        mobile: req.body.mobile,
      products: req.body.products.map(p => ({
  ...p,
  quantity: Number(p.quantity)
}))
      },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({ msg: "Error updating distribution" });
  }
});

app.get("/distribution/:employeeId", async (req, res) => {
  try {
    const data = await Distribution.find({
      employeeId: req.params.employeeId
    }).sort({ date: -1 }); // latest first

    res.json(data);
  } catch (err) {
    console.log("FETCH ERROR:", err);
    res.status(500).json({ msg: "Error fetching distribution" });
  }
});


app.get("/distribution-filter/:employeeId", async (req, res) => {
  const { start, end } = req.query;

  const data = await Distribution.find({
    employeeId: req.params.employeeId,
    date: {
      $gte: new Date(start),
      $lte: new Date(end)
    }
  });

  res.json(data);
});
app.get("/clients/:employeeId", async (req, res) => {
  try {
    const data = await Client.find({
      employeeId: req.params.employeeId
    });

    res.json(data);

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error fetching clients" });
  }
});

const cron = require("node-cron");

// ⏰ run every hour
cron.schedule("0 * * * *", async () => {
  console.log("Checking employees for inactivity...");

  const employees = await Employee.find();
  const now = new Date();

  for (let emp of employees) {
    if (!emp.lastDistributionDate) continue;

    const diffHours =
      (now - new Date(emp.lastDistributionDate)) / (1000 * 60 * 60);

    if (diffHours > 72 && emp.status !== "suspended") {
      await Employee.findByIdAndUpdate(emp._id, {
        status: "suspended"
      });

      console.log(`Suspended: ${emp.name}`);
    }
  }
});
// ================= SERVER =================
app.listen(5000, () => console.log("Server running on 5000"));