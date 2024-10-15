const fs = require('fs');
const path = require('path');

// Path to whitelist.json
const whitelistPath = path.join(__dirname, 'whitelist.json');

// Load the whitelist
let whitelist = {};
if (fs.existsSync(whitelistPath)) {
    const data = fs.readFileSync(whitelistPath);
    whitelist = JSON.parse(data);
}

// Function to save the whitelist
const saveWhitelist = () => {
    fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));
};

// Handle API requests
const handler = (req, res) => {
    const { action, product, owner_id, user_id, api_key, guild_id } = req.body;

    switch (action) {
        case 'create_product':
            if (!owner_id) {
                return res.status(400).json({ error: 'Owner ID is required.' });
            }

            // Check if product already exists
            if (whitelist[product]) {
                return res.status(400).json({ error: 'Product already exists.' });
            }

            // Create new product
            whitelist[product] = {
                owner_id: owner_id,
                key: null,
                hwid: null,
                guilds: []
            };

            // Save changes
            saveWhitelist();

            // Generate an API key (simple version)
            const apiKey = generateApiKey();
            return res.status(200).json({ message: 'Product created successfully.', api_key: apiKey });

        case 'set_api_key':
            if (!api_key || !user_id || !guild_id) {
                return res.status(400).json({ error: 'API key, user ID, and guild ID are required.' });
            }

            // Find the product
            const productData = whitelist[product];
            if (!productData) {
                return res.status(404).json({ error: 'Product not found.' });
            }

            // Set user and guild
            if (productData.owner_id === owner_id) {
                productData.guilds.push(guild_id);
                saveWhitelist();
                return res.status(200).json({ message: 'API key set successfully.' });
            } else {
                return res.status(403).json({ error: 'You do not have permission to set this API key.' });
            }

        case 'create_key':
            if (!owner_id) {
                return res.status(400).json({ error: 'Owner ID is required.' });
            }

            const newKey = generateKey();
            whitelist[product].key = newKey; // Assign the generated key to the product
            whitelist[product].hwid = null; // Initially set HWID to null
            saveWhitelist();
            return res.status(200).json({ key: newKey });

        case 'redeem_key':
            if (!user_id) {
                return res.status(400).json({ error: 'User ID is required.' });
            }

            if (!whitelist[product]) {
                return res.status(404).json({ error: 'Product not found.' });
            }

            const keyData = whitelist[product].key;
            if (!keyData) {
                return res.status(404).json({ error: 'No key available for this product.' });
            }

            // Link the user to the key
            whitelist[product].hwid = user_id; // Set HWID to user ID
            saveWhitelist();
            return res.status(200).json({ message: 'Key redeemed successfully.' });

        case 'resethwid':
            if (!api_key || !user_id) {
                return res.status(400).json({ error: 'API key and user ID are required.' });
            }

            if (whitelist[product].hwid === user_id) {
                whitelist[product].hwid = null; // Reset HWID
                saveWhitelist();
                return res.status(200).json({ message: 'HWID reset successfully.' });
            } else {
                return res.status(403).json({ error: 'You do not have permission to reset HWID.' });
            }

        default:
            res.status(400).json({ error: 'Invalid action.' });
    }
};

// Utility function to generate a random key
const generateKey = () => {
    return Math.random().toString(36).substring(2, 22); // 20 character key
};

// Simple API key generator (for demonstration purposes)
const generateApiKey = () => {
    return Math.random().toString(36).substring(2, 12); // Short API key for demo
};

// Export the handler
module.exports = handler;
