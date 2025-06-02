const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./database'); // ✅ use existing pool✅ Using PostgreSQL

const app = express();
app.use(express.json());

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    next();
});

// ✅ API Routes

app.get("/api/orders", async (req, res) => {
    try {
        console.log("🛠 Attempting to query the latest orders...");
        await pool.query("DISCARD ALL");
        const result = await pool.query("SELECT * FROM Orders2 ORDER BY start_time DESC LIMIT 10");

        if (!result.rows.length) {
            return res.status(404).json({ message: "No orders found" });
        }

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/check-duplicate", async (req, res) => {
    try {
        const { customer_name, client_contact, paint_type, category } = req.query;
        const result = await pool.query(
            "SELECT COUNT(*) AS count FROM Orders2 WHERE customer_name = $1 AND client_contact = $2 AND paint_type = $3 AND category = $4", 
            [customer_name, client_contact, paint_type, category]
        );
        res.json({ exists: result.rows[0].count > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/order-status/:trackID", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_status, estimated_completion FROM Orders2 WHERE transaction_id = $1", 
            [req.params.trackID]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({
            status: result.rows[0].current_status,
            estimatedCompletion: result.rows[0].estimated_completion
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/active-orders-count", async (req, res) => {
    try {
        const result = await pool.query("SELECT COUNT(*) AS activeOrders FROM Orders2 WHERE current_status IN ('Waiting', 'Mixing')");
        res.json({ activeOrders: result.rows[0].activeorders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM Orders2 LIMIT 1");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/orders/:id", async (req, res) => {
    try {
        const { current_status } = req.body;
        const { id } = req.params;

        await pool.query(
            "UPDATE Orders2 SET current_status = $1 WHERE id = $2",
            [current_status, id]
        );

        res.json({ message: "✅ Order status updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/orders", async (req, res) => {
    try {
        await pool.query("BEGIN");

        const { transaction_id, customer_name, client_contact, paint_type, colour_code, category } = req.body;

        if (!transaction_id || !customer_name || !client_contact || !paint_type || !category) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const values = [
            transaction_id,
            customer_name,
            client_contact,
            paint_type,
            colour_code || "Pending",
            category,
            "Standard",
            new Date().toISOString(),
            req.body.estimated_completion || "N/A",
            req.body.current_status || "Pending"
        ];

        const query = `
            INSERT INTO Orders2 (
                transaction_id, customer_name, client_contact, 
                paint_type, colour_code, category, priority, 
                start_time, estimated_completion, current_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;

        const newOrder = await pool.query(query, values);
        await pool.query("COMMIT");

        const insertedOrder = newOrder.rows[0];
        return res.status(201).json(insertedOrder);

    } catch (err) {
        await pool.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    }
});

// ✅ Serve React static files in production
app.use(express.static(path.join(__dirname, "client", "build")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

// ✅ Basic root health check
app.get("/", (req, res) => {
    res.send("🚀 Backend is alive! 🫠 ");
});

// ✅ Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
