/**
 * Utility for generating Brazilian PIX BRCode (Static) payloads
 * and handling payment expiration logic.
 */

/**
 * Normalizes text for PIX fields (removes accents, limits length)
 * @param allowSpaces - If false, removes all spaces (critical for TXID)
 */
export const normalizePixText = (text: string, maxLength: number, allowSpaces: boolean = true): string => {
    if (!text) return "";
    let normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remove accents

    if (allowSpaces) {
        normalized = normalized
            .replace(/[^a-zA-Z0-9]/g, " ")   // Replace special characters with space
            .replace(/\s+/g, " ")            // Collapse multiple spaces
            .trim();
    } else {
        normalized = normalized
            .replace(/[^a-zA-Z0-9]/g, "")    // Remove all special characters
            .replace(/\s+/g, "");           // Remove all spaces
    }

    return normalized.substring(0, maxLength).toUpperCase();
};

/**
 * Sanitizes PIX keys (removes formatting from CPF/CNPJ/Phone)
 */
export const sanitizePixKey = (key: string): string => {
    if (!key) return "";
    const sanitized = key.trim();

    // For emails and random keys
    if (sanitized.includes('@') || (sanitized.length > 20 && !sanitized.match(/^\d/))) {
        return sanitized;
    }

    const digits = sanitized.replace(/\D/g, "");

    // CNPJ (14 digits)
    if (digits.length === 14) return digits;

    // CPF (11 digits) vs Phone (11 digits)
    if (digits.length === 11) {
        // If it looks like a phone (has parens or starts with +55 or is explicitly formatted as phone)
        if (sanitized.includes('(') || sanitized.includes(')') || sanitized.startsWith('+')) {
            return `+55${digits.startsWith('55') ? digits.substring(2) : digits}`;
        }
        // If it starts with common DDDs and doesn't have CPF markers
        const isLikelyPhone = !sanitized.includes('.') && !sanitized.includes('-') && digits.match(/^[1-9]{2}9/);
        if (isLikelyPhone) return `+55${digits}`;

        return digits; // Default to CPF if 11 digits and not obviously a phone
    }

    // Phone with 10 digits (no 9)
    if (digits.length === 10) return `+55${digits}`;

    // Phone with country code (12 or 13 digits)
    if (digits.length === 12 || digits.length === 13) {
        return `+${digits}`;
    }

    return digits || sanitized;
};

/**
 * Formats a PIX field with ID and length padding
 */
const formatField = (id: string, value: string): string => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
};

/**
 * Calculates CRC16 CCITT (Poly 0x1021, Init 0xFFFF)
 */
const calculateCRC16 = (data: string): string => {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Generates a full PIX BRCode payload
 */
export const generatePixPayload = (params: {
    key: string;
    name: string;
    city: string;
    amount: number;
    transactionId?: string;
}): string => {
    const { key, name, city, amount, transactionId } = params;

    // Tag 00: Payload Format Indicator
    const payloadFormat = "000201";

    // Tag 26: Merchant Account Information
    const sanitizedKey = sanitizePixKey(key);
    const merchantInfo = formatField('00', 'br.gov.bcb.pix') + formatField('01', sanitizedKey);
    const tag26 = formatField('26', merchantInfo);

    // Tag 52: Merchant Category Code
    const tag52 = formatField('52', '0000');

    // Tag 53: Transaction Currency (986 = BRL)
    const tag53 = formatField('53', '986');

    // Tag 54: Transaction Amount
    const tag54 = formatField('54', amount.toFixed(2));

    // Tag 58: Country Code
    const tag58 = formatField('58', 'BR');

    // Tag 59: Merchant Name
    const tag59 = formatField('59', normalizePixText(name, 25));

    // Tag 60: Merchant City
    const tag60 = formatField('60', normalizePixText(city || 'SAO PAULO', 15));

    // Tag 62: Additional Data Field Template
    // TXID cannot have spaces and should be max 25 chars. Standard uses '***' if none.
    const txId = transactionId ? normalizePixText(transactionId, 25, false) : '***';
    const tag62 = formatField('62', formatField('05', txId));

    // Tag 63: CRC16
    const payloadWithoutCRC = [
        payloadFormat,
        tag26,
        tag52,
        tag53,
        tag54,
        tag58,
        tag59,
        tag60,
        tag62,
        '6304' // Tag and Length for CRC
    ].join('');

    return payloadWithoutCRC + calculateCRC16(payloadWithoutCRC);
};

/**
 * Checks if a payment has expired (default: 1 hour)
 */
export const isPixExpired = (createdAt: string | Date, expirationHours: number = 1): boolean => {
    const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const diffInMs = now.getTime() - createdDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours >= expirationHours;
};

/**
 * Gets remaining time in seconds for PIX expiration
 */
export const getPixRemainingTime = (createdAt: string | Date, expirationHours: number = 1): number => {
    const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const expirationDate = new Date(createdDate.getTime() + expirationHours * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = expirationDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(remainingMs / 1000));
};
