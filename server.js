require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

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
  password: String,
  status: { type: String, default: "active" },
  image: String
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

// ================= ADMIN LOGIN =================
const ADMIN_ID = "admin";
const ADMIN_PASS = "12345";

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
  const emp = new Employee({
    ...req.body,
    image: req.file ? req.file.filename : ""
  });
  await emp.save();
  res.json(emp);
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

    const cleanedProducts = req.body.products.map(p => ({
      ...p,
      quantity: Number(p.quantity)
    }));

    const data = new Distribution({
      ...req.body,
      employeeName: emp.name,   // ✅ ADD THIS
      products: cleanedProducts
    });

    await data.save();
    res.json(data);

  } catch (err) {
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
      updateData.image = req.file.filename;
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




// ================= SERVER =================
app.listen(5000, () => console.log("Server running on 5000"));