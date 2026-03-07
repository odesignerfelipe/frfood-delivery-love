/**
 * Utility for generating Brazilian PIX BRCode (Static) payloads
 * and handling payment expiration logic.
 */

/**
 * Normalizes text for PIX fields (removes accents, limits length)
 */
export const normalizePixText = (text: string, maxLength: number): string => {
    if (!text) return "";
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9]/g, " ")   // Replace special characters with space
        .replace(/\s+/g, " ")            // Collapse multiple spaces
        .trim()
        .substring(0, maxLength)
        .toUpperCase();
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
    const merchantInfo = formatField('00', 'br.gov.bcb.pix') + formatField('01', key);
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
    const txId = transactionId ? normalizePixText(transactionId, 25) : '***';
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
