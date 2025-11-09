const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class TelegramUtil {
    constructor(botToken, chatId) {
        this.botToken = botToken;
        this.chatId = chatId;
    }

    async sendMessage(message) {
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: this.chatId,
                text: message,
                parse_mode: "HTML"
            });
        } catch (error) {
            console.error("Error sending Telegram message:", error);
        }
    }

    async sendFile(filePath, caption) {
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
            const form = new FormData();

            form.append("chat_id", this.chatId);
            form.append("document", fs.createReadStream(filePath), {
                filename: path.basename(filePath),
                contentType: "application/json"
            });

            if (caption) {
                form.append("caption", caption);
            }

            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            return response.data;
        } catch (error) {
            console.error(
                "Error sending file to Telegram:",
                error.response?.data || error.message
            );
        }
    }
}

module.exports = TelegramUtil;
