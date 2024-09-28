const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // Serve static assets (CSS, JS, images)

// Session management
app.use(
  session({
    secret: "Iamsaved.", // Change to a strong secret key
    resave: false,
    saveUninitialized: false, // Better to set to false
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    },
  })
);

// Middleware to renew session on activity
app.use((req, res, next) => {
  if (req.session) {
    req.session._garbage = Date();
    req.session.touch();
  }
  next();
});

// In-memory storage (or you can store it in a JSON file for persistence)
let users = [];
let expenses = [];
// Example updateExpense function
const updateExpense = (id, updatedData) => {
  // Logic to update the expense in your database or data source
  const expense = getExpenseById(id); // Assuming you have a function to get an expense by ID

  if (!expense) {
    throw new Error("Expense not found");
  }

  // Update fields
  expense.amount = updatedData.amount || expense.amount;
  expense.date = updatedData.date || expense.date;
  expense.description = updatedData.description || expense.description;

  // Save updated expense logic (this depends on how you're handling data)
  return expense; // Return the updated expense or a success message
};
//function to validate date
function validateDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  // Check if the date is valid and not too far in the future
  return (
    date.toString() !== "Invalid Date" &&
    date <= new Date(now.getFullYear() + 100, 11, 31)
  );
}
const getExpenseById = (expenseId) => {
  // Convert expenseId to number to match the data type
  return expenses.find((expense) => expense.id === parseInt(expenseId));
};
// Helper functions to read/write data to a JSON file
const writeDataToFile = (filename, content) => {
  fs.writeFileSync(filename, JSON.stringify(content, null, 2), "utf8");
};

const readDataFromFile = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8") || "[]");
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

// Load data from files (if needed for persistence)
if (fs.existsSync("users.json")) {
  users = readDataFromFile("users.json");
}
if (fs.existsSync("expenses.json")) {
  expenses = readDataFromFile("expenses.json");
}

// Routes

// Serve the home page (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Serve the registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

// User Registration Route
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  if (users.find((user) => user.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }
  // Hash the password and store the user
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).json({ message: "Error registering user" });
    }

    const newUser = {
      id: users.length + 1,
      name,
      email,
      password: hashedPassword,
    };
    users.push(newUser);

    // Persist the users data
    writeDataToFile("users.json", users);

    // Redirect to the login page after successful registration
    res
      .status(200)
      .json({ message: "Registration successful. Redirecting to login..." });
  });
});

// Serve the login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});
// Serve the edit expense HTML page
app.get("/edit_expense/:id", (req, res) => {
  const expenseId = req.params.id; // Capture the expense ID from the URL
  res.sendFile(path.join(__dirname, "views", "edit_expense.html"));
});

// API route to fetch the expense data
app.get("/api/edit_expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  try {
    // Replace with your own function to get an expense by ID
    const expense = await getExpenseById(expenseId);

    if (!expense) {
      // If no expense is found, return a 404 error with JSON
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    res.json({ success: true, expense }); // Send the expense data as JSON
  } catch (error) {
    console.error("Error fetching expense:", error);
    // Return a JSON object on error
    res.status(500).json({ success: false, message: "Error fetching expense" });
  }
});

// User Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (!user) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err || !isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Store user information in session
    req.session.userId = user.id;
    req.session.userName = user.name;

    // Redirect to the expenses page
    res
      .status(200)
      .json({ message: "Login successful. Redirecting to expenses page..." });
  });
});

// Serve the expense pages
app.get("/add_expense", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "add_expense.html"));
});

app.get("/edit_expense", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "edit_expense.html"));
});

app.get("/view_expense", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "view_expense.html"));
});

// Add Expense Route
app.post("/add-expense", (req, res) => {
  const { date, amount, description } = req.body;

  // Check if user is authenticated
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Validate input on the backend as well
  if (!date || !amount || !description) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (description.length > 100) {
    return res
      .status(400)
      .json({ message: "Description must be 100 characters or less." });
  }

  const descriptionPattern = /^[a-zA-Z0-9\s]+$/;
  if (!descriptionPattern.test(description)) {
    return res.status(400).json({
      message: "Description can only contain letters, numbers, and spaces.",
    });
  }

  const newExpense = {
    id: expenses.length + 1,
    userId: req.session.userId,
    date,
    amount,
    description,
  };
  expenses.push(newExpense);

  // Persist expenses data
  writeDataToFile("expenses.json", expenses);

  res.status(200).json({ message: "Expense added successfully" });
});

// Get Expenses Route
app.get("/expenses", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userExpenses = expenses.filter(
    (expense) => expense.userId === req.session.userId
  );
  res.status(200).json(userExpenses);
});
// API route to fetch the expense data
app.get("/api/edit_expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  try {
    // Replace with your own function to get an expense by ID
    const expense = await getExpenseById(expenseId); // This function should be implemented

    if (!expense) {
      // If no expense is found, return a 404 error with JSON
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    res.json({ success: true, expense }); // Send the expense data as JSON
  } catch (error) {
    console.error("Error fetching expense:", error);
    // Return a JSON object on error
    res.status(500).json({ success: false, message: "Error fetching expense" });
  }
});
app.get("/api/expenses/:id", async (req, res) => {
  const expenseId = req.params.id;
  const isValidDate = validateDate(date);
  if (!isValidDate) {
    return res.status(400).json({ message: "Invalid date provided." });
  }
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const expense = expenses.find(
    (exp) => exp.id === parseInt(expenseId) && exp.userId === req.session.userId
  );

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  res.status(200).json(expense);
});

app.put("/edit_expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  const { amount, description, date } = req.body;
  try {
    // Replace with your own function to update the expense
    const result = await updateExpense(expenseId, {
      amount,
      description,
      date,
    });

    if (!result) {
      // Handle case where the update fails, maybe because the expense doesn't exist
      return res.status(404).json({
        success: false,
        message: "Expense not found or update failed",
      });
    }
    // Persist expenses data
    writeDataToFile("expenses.json", expenses);
    res.json({ success: true, result }); // Send a success message with the updated expense
  } catch (error) {
    console.error("Error updating expense:", error);
    // Return a JSON object on error
    res.status(500).json({ success: false, message: "Error updating expense" });
  }
});

// Load existing expenses from the JSON file
function loadExpenses() {
  return JSON.parse(fs.readFileSync("expenses.json", "utf8"));
}

app.put("/edit-expense/:id", (req, res) => {
  // Ensure expenseId is a number for comparison
  const expenseId = parseInt(req.params.id, 10);
  const { date, amount, description } = req.body;

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!date || !amount || !description) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Load expenses before searching
  const expenses = loadExpenses();

  const expense = expenses.find(
    (exp) => exp.id === expenseId && exp.userId === req.session.userId
  );

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  // Update the expense object
  expense.date = date;
  expense.amount = amount;
  expense.description = description;

  // Save the updated expenses back to the JSON file
  writeDataToFile("expenses.json", expenses);
  res.status(200).json({ message: "Expense updated successfully" });
});

// Delete Expense Route
app.delete("/delete-expense/:id", (req, res) => {
  const expenseId = parseInt(req.params.id);

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const expenseIndex = expenses.findIndex(
    (exp) => exp.id === expenseId && exp.userId === req.session.userId
  );

  if (expenseIndex === -1) {
    return res.status(404).json({ message: "Expense not found" });
  }

  expenses.splice(expenseIndex, 1);
  writeDataToFile("expenses.json", expenses);

  res.status(200).json({ message: "Expense deleted successfully" });
});

// Get total expenses for the user
app.get("/api/expense", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userExpenses = expenses.filter(
    (exp) => exp.userId === req.session.userId
  );
  const total = userExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amount),
    0
  );

  res.status(200).json({ total });
});
function updateExpenseInJson(expenseId, updatedExpense) {
  const expenseIndex = expenses.findIndex(
    (expense) => expense.id === expenseId
  );
  if (expenseIndex !== -1) {
    // Update the expense
    expenses[expenseIndex] = { ...expenses[expenseIndex], ...updatedExpense };
  } else {
    throw new Error("Expense not found");
  }
}
function saveExpensesToJson() {
  fs.writeFileSync(
    "path/to/your/expenses.json",
    JSON.stringify(expenses, null, 2),
    "utf8"
  );
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
