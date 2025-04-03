import jsPDF from 'jspdf';

/**
 * Exports the deck's title and cards to a PDF document.
 * @param {object} deck - The deck object (needs at least a 'title' property).
 * @param {Array<object>} cards - Array of card objects (need 'question' and 'answer').
 * @param {function} setIsExportingPDF - Setter for the PDF export loading state.
 * @param {function} setSuccessMessage - Setter for success messages.
 * @param {function} setErrorMessage - Setter for error messages.
 */
export const exportDeckToPDF = (deck, cards, setIsExportingPDF, setSuccessMessage, setErrorMessage) => {
    if (!deck || !cards || cards.length === 0) {
        alert("No cards available in this deck to export.");
        return;
    }

    setIsExportingPDF(true);

    try {
        const doc = new jsPDF({
            orientation: 'p', unit: 'mm', format: 'a4'
        });

        // --- PDF Configuration ---
        const marginLeft = 15, marginRight = 15, marginTop = 20, marginBottom = 20;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const usableWidth = pageWidth - marginLeft - marginRight;
        const titleFontSize = 18, cardFontSize = 11, prefixFontSize = 10;
        const questionPrefix = "Q: ", answerPrefix = "A: ";
        const cardSpacing = 8, lineSpacing = 1;
        const textLineHeight = (cardFontSize / 3.5) + lineSpacing;

        let currentY = marginTop;

        // --- Helper for wrapped text and page breaks ---
        const addWrappedText = (text, x, y, options = {}) => {
            const { fontSize = cardFontSize, maxWidth = usableWidth, textColor = [0, 0, 0] } = options;
            doc.setFontSize(fontSize);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line) => {
                if (currentY + textLineHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = marginTop;
                }
                doc.text(line, x, currentY);
                currentY += textLineHeight;
            });
            return lines.length;
        };

        // --- Add Deck Title ---
        addWrappedText(deck.title || "Flashcards", marginLeft, currentY, { fontSize: titleFontSize });
        currentY += cardSpacing;

        // --- Add Cards ---
        cards.forEach((card, index) => {
            const startY = currentY;

            // Question
            doc.setFontSize(prefixFontSize); doc.setTextColor(50, 50, 50);
            doc.text(questionPrefix, marginLeft, currentY);
            const questionLines = addWrappedText(card.question || "-", marginLeft + doc.getTextWidth(questionPrefix) + 1, currentY, { fontSize: cardFontSize, maxWidth: usableWidth - (doc.getTextWidth(questionPrefix) + 1), textColor: [0, 0, 0] });
            if (questionLines <= 1) currentY = Math.max(currentY, startY + textLineHeight);

            const questionEndY = currentY;
            currentY += lineSpacing * 2; // Space before answer

            if (currentY + textLineHeight > pageHeight - marginBottom) { doc.addPage(); currentY = marginTop; }

            // Answer
            doc.setFontSize(prefixFontSize); doc.setTextColor(50, 50, 50);
            doc.text(answerPrefix, marginLeft, currentY);
            const answerLines = addWrappedText(card.answer || "-", marginLeft + doc.getTextWidth(answerPrefix) + 1, currentY, { fontSize: cardFontSize, maxWidth: usableWidth - (doc.getTextWidth(answerPrefix) + 1), textColor: [50, 50, 50] });
             if (answerLines <= 1) currentY = Math.max(currentY, questionEndY + lineSpacing*2 + textLineHeight);


            // Separator
            if (index < cards.length - 1) {
                currentY += cardSpacing / 2;
                if (currentY + 2 > pageHeight - marginBottom) {
                    doc.addPage(); currentY = marginTop;
                } else {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
                    currentY += cardSpacing / 2;
                }
            }
        });

        // --- Save PDF ---
        const filename = `${deck.title.replace(/[^a-z0-9]/gi, '_') || 'flashcards'}_export.pdf`;
        doc.save(filename);
        setSuccessMessage("PDF exported successfully!");

    } catch (e) {
        console.error("Error generating or saving PDF:", e);
        setErrorMessage("Failed to generate PDF. Please try again.");
    } finally {
        setIsExportingPDF(false);
    }
};