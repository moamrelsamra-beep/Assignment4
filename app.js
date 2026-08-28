const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;
app.use(express.json());

// 1. Configure MySQL connection pool using mysql2/promise
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'root', // قم بتغيير كلمة السر حسب إعداداتك (فارغة "" لـ XAMPP الافتراضي)
    multipleStatements: true
});

// Endpoint to Initialize Database and Tables (Requirement 1)[cite: 1]
app.get('/init', async (req, res) => {
    try {
        const initQuery = `
            CREATE DATABASE IF NOT EXISTS retail_store;
            USE retail_store;

            CREATE TABLE IF NOT EXISTS Suppliers (
                SupplierID INT AUTO_INCREMENT PRIMARY KEY,
                SupplierName TEXT,
                ContactNumber TEXT
            );

            CREATE TABLE IF NOT EXISTS Products (
                ProductID INT AUTO_INCREMENT PRIMARY KEY,
                ProductName TEXT,
                Price DECIMAL(10, 2),
                StockQuantity INT,
                SupplierID INT,
                FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID)
            );

            CREATE TABLE IF NOT EXISTS Sales (
                SaleID INT AUTO_INCREMENT PRIMARY KEY,
                ProductID INT,
                QuantitySold INT,
                SaleDate DATE,
                FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
            );
        `;
        await pool.query(initQuery);
        res.status(200).json({ message: "Database and tables created successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware to ensure using retail_store DB for all subsequent queries
app.use(async (req, res, next) => {
    await pool.query('USE retail_store;');
    next();
});

// ==========================================
// 2. Products CRUD Operations[cite: 1]
// ==========================================
app.post('/products', async (req, res) => {
    const { ProductName, Price, StockQuantity, SupplierID } = req.body;
    await pool.query('INSERT INTO Products (ProductName, Price, StockQuantity, SupplierID) VALUES (?, ?, ?, ?)', [ProductName, Price, StockQuantity, SupplierID]);
    res.status(201).json({ message: "Product created" });
});

app.get('/products', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM Products');
    res.status(200).json(rows);
});

app.get('/products/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM Products WHERE ProductID = ?', [req.params.id]);
    res.status(200).json(rows[0] || {});
});

app.put('/products/:id', async (req, res) => {
    const { ProductName, Price, StockQuantity, SupplierID } = req.body;
    await pool.query('UPDATE Products SET ProductName=?, Price=?, StockQuantity=?, SupplierID=? WHERE ProductID=?', [ProductName, Price, StockQuantity, SupplierID, req.params.id]);
    res.status(200).json({ message: "Product updated" });
});

app.delete('/products/:id', async (req, res) => {
    await pool.query('DELETE FROM Products WHERE ProductID = ?', [req.params.id]);
    res.status(200).json({ message: "Product deleted" });
});

// ==========================================
// 3. Suppliers CRUD Operations[cite: 1]
// ==========================================
app.post('/suppliers', async (req, res) => {
    const { SupplierName, ContactNumber } = req.body;
    await pool.query('INSERT INTO Suppliers (SupplierName, ContactNumber) VALUES (?, ?)', [SupplierName, ContactNumber]);
    res.status(201).json({ message: "Supplier created" });
});

app.get('/suppliers', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM Suppliers');
    res.status(200).json(rows);
});

app.put('/suppliers/:id', async (req, res) => {
    const { SupplierName, ContactNumber } = req.body;
    await pool.query('UPDATE Suppliers SET SupplierName=?, ContactNumber=? WHERE SupplierID=?', [SupplierName, ContactNumber, req.params.id]);
    res.status(200).json({ message: "Supplier updated" });
});

app.delete('/suppliers/:id', async (req, res) => {
    await pool.query('DELETE FROM Suppliers WHERE SupplierID = ?', [req.params.id]);
    res.status(200).json({ message: "Supplier deleted" });
});

// ==========================================
// 4. Sales Operations[cite: 1]
// ==========================================
app.post('/sales', async (req, res) => {
    const { ProductID, QuantitySold, SaleDate } = req.body;
    await pool.query('INSERT INTO Sales (ProductID, QuantitySold, SaleDate) VALUES (?, ?, ?)', [ProductID, QuantitySold, SaleDate]);
    res.status(201).json({ message: "Sale recorded" });
});

app.get('/sales', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM Sales');
    res.status(200).json(rows);
});

app.get('/sales/product/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM Sales WHERE ProductID = ?', [req.params.id]);
    res.status(200).json(rows);
});

// ==========================================
// 5. Database Modifications (ALTER TABLE)[cite: 1]
// ==========================================
app.post('/modifications', async (req, res) => {
    try {
        await pool.query(`
            ALTER TABLE Products ADD COLUMN Category VARCHAR(50);
            ALTER TABLE Products DROP COLUMN Category;
            ALTER TABLE Suppliers MODIFY ContactNumber VARCHAR(15);
            ALTER TABLE Products MODIFY ProductName VARCHAR(255) NOT NULL;
        `);
        res.status(200).json({ message: "Modifications applied successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. Seed Data Script[cite: 1]
// ==========================================
app.post('/seed', async (req, res) => {
    try {
        const [supplierResult] = await pool.query("INSERT INTO Suppliers (SupplierName, ContactNumber) VALUES ('FreshFoods', '01001234567')");
        const freshFoodsID = supplierResult.insertId;

        await pool.query(`INSERT INTO Products (ProductName, Price, StockQuantity, SupplierID) VALUES 
            ('Milk', 15.00, 50, ?), 
            ('Bread', 10.00, 30, ?), 
            ('Eggs', 20.00, 40, ?)`, 
            [freshFoodsID, freshFoodsID, freshFoodsID]);

        const [milkRows] = await pool.query("SELECT ProductID FROM Products WHERE ProductName = 'Milk'");
        if(milkRows.length > 0) {
            await pool.query("INSERT INTO Sales (ProductID, QuantitySold, SaleDate) VALUES (?, 2, '2025-05-20')", [milkRows[0].ProductID]);
        }
        
        res.status(200).json({ message: "Seed data inserted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 7 & 8. Specific Update and Delete[cite: 1]
// ==========================================
app.put('/products/update-bread', async (req, res) => {
    await pool.query("UPDATE Products SET Price = 25.00 WHERE ProductName = 'Bread'");
    res.status(200).json({ message: "Bread price updated" });
});

app.delete('/products/delete-eggs', async (req, res) => {
    await pool.query("DELETE FROM Products WHERE ProductName = 'Eggs'");
    res.status(200).json({ message: "Eggs deleted" });
});

// ==========================================
// 9 - 13. Reporting Endpoints[cite: 1]
// ==========================================
// 9. Total quantity sold per product[cite: 1]
app.get('/reports/sales-by-product', async (req, res) => {
    const [rows] = await pool.query(`SELECT ProductID, SUM(QuantitySold) as TotalSold FROM Sales GROUP BY ProductID`);
    res.status(200).json(rows);
});

// 10. Product with highest stock[cite: 1]
app.get('/reports/highest-stock', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM Products ORDER BY StockQuantity DESC LIMIT 1`);
    res.status(200).json(rows[0]);
});

// 11. Suppliers starting with 'F'[cite: 1]
app.get('/reports/suppliers-f', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM Suppliers WHERE SupplierName LIKE 'F%'`);
    res.status(200).json(rows);
});

// 12. Products never sold[cite: 1]
app.get('/reports/unsold-products', async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.* FROM Products p
        LEFT JOIN Sales s ON p.ProductID = s.ProductID
        WHERE s.SaleID IS NULL
    `);
    res.status(200).json(rows);
});

// 13. Sales details with product name[cite: 1]
app.get('/reports/sales-details', async (req, res) => {
    const [rows] = await pool.query(`
        SELECT p.ProductName, s.QuantitySold, s.SaleDate 
        FROM Sales s
        JOIN Products p ON s.ProductID = p.ProductID
    `);
    res.status(200).json(rows);
});

// ==========================================
// 14 - 16. Permissions Management[cite: 1]
// ==========================================
app.post('/admin/permissions', async (req, res) => {
    try {
        await pool.query(`
            CREATE USER IF NOT EXISTS 'store_manager'@'localhost' IDENTIFIED BY 'manager123';
            GRANT SELECT, INSERT, UPDATE ON retail_store.* TO 'store_manager'@'localhost';
            REVOKE UPDATE ON retail_store.* FROM 'store_manager'@'localhost';
            GRANT DELETE ON retail_store.Sales TO 'store_manager'@'localhost';
            FLUSH PRIVILEGES;
        `);
        res.status(200).json({ message: "Permissions configured successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));