import { Page, BrowserContext, expect } from "@playwright/test";
import { GameState, GameStatus } from "@/types";

/**
 * Test helper utilities for Quiz0r E2E tests
 */

export interface TestQuizConfig {
    title: string;
    description?: string;
    questionCount?: number;
    questionType?: "SINGLE_SELECT" | "MULTI_SELECT" | "MIXED";
    timeLimit?: number;
    points?: number;
    hintCount?: number;
    copyAnswerCount?: number;
    doublePointsCount?: number;
    randomizeCorrectAnswers?: boolean;
    languages?: string[];  // Array of language codes to add translations for (e.g., ['es', 'fr'])
}

export interface PlayerJoinConfig {
    gameCode: string;
    playerName: string;
    avatarType?: "emoji" | "custom";
    languageCode?: string;
}

/**
 * Creates a test quiz via API with configurable questions
 */
export async function createTestQuiz(
    page: Page,
    config: TestQuizConfig
): Promise<{ quizId: string; questionIds: string[] }> {
    const baseURL = process.env.BASE_URL || "http://localhost:3000";

    const {
        title,
        description = "Test quiz created by E2E tests",
        questionCount = 5,
        questionType = "SINGLE_SELECT",
        timeLimit = 30,
        points = 100,
        hintCount = 2,
        copyAnswerCount = 2,
        doublePointsCount = 2,
        randomizeCorrectAnswers = true,
        languages,
    } = config;

    // Create quiz
    const quizRes = await page.request.post(`${baseURL}/api/quizzes`, {
        data: { title, description },
    });
    expect(quizRes.ok()).toBeTruthy();
    const quiz = await quizRes.json();

    // Update quiz with powerup configuration using PATCH
    const updateRes = await page.request.patch(`${baseURL}/api/quizzes/${quiz.id}`, {
        data: {
            hintCount,
            copyAnswerCount,
            doublePointsCount,
        },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updatedQuiz = await updateRes.json();

    console.log(`   💡 Powerups configured: ${updatedQuiz.hintCount || 0} hints, 📋 ${updatedQuiz.copyAnswerCount || 0} copies, ✨ ${updatedQuiz.doublePointsCount || 0} 2x`);

    // Add questions
    const questionIds: string[] = [];
    for (let i = 0; i < questionCount; i++) {
        const isSingleSelect =
            questionType === "SINGLE_SELECT" ||
            (questionType === "MIXED" && i % 2 === 0);

        // Randomize which answer is correct
        let correctAnswerIndex = 0; // Default to A
        if (randomizeCorrectAnswers) {
            correctAnswerIndex = Math.floor(Math.random() * 4); // 0-3 for A-D
        }

        // Create answers array with randomized correct answer
        const answers = [
            { answerText: "Answer A", isCorrect: correctAnswerIndex === 0 },
            { answerText: "Answer B", isCorrect: isSingleSelect ? (correctAnswerIndex === 1) : (correctAnswerIndex === 1 || correctAnswerIndex === 0) },
            { answerText: "Answer C", isCorrect: correctAnswerIndex === 2 },
            { answerText: "Answer D", isCorrect: correctAnswerIndex === 3 },
        ];

        const questionData = {
            questionText: `Test Question ${i + 1}`,
            questionType: isSingleSelect ? "SINGLE_SELECT" : "MULTI_SELECT",
            timeLimit,
            points,
            answers,
            hint: hintCount > 0 ? `Hint for question ${i + 1}: Look for clues in the wording!` : null,
        };

        const questionRes = await page.request.post(
            `${baseURL}/api/quizzes/${quiz.id}/questions`,
            { data: questionData }
        );
        expect(questionRes.ok()).toBeTruthy();
        const question = await questionRes.json();
        questionIds.push(question.id);
    }

    // Add translations if languages are specified
    if (languages && languages.length > 0) {
        console.log(`   🌐 Adding translations for: ${languages.join(', ')}`);
        const translationsAdded = await addTranslationsToQuiz(page, quiz.id, languages);
        if (translationsAdded) {
            console.log(`   ✓ Translations added successfully`);
        } else {
            console.log(`   ⚠️  Failed to add translations`);
        }
    }

    return { quizId: quiz.id, questionIds };
}

/**
 * Creates a game session and returns the game code
 */
export async function createGameSession(
    page: Page,
    quizId: string
): Promise<string> {
    const baseURL = process.env.BASE_URL || "http://localhost:3000";

    const gameRes = await page.request.post(`${baseURL}/api/games`, {
        data: { quizId },
    });
    expect(gameRes.ok()).toBeTruthy();
    const game = await gameRes.json();

    expect(game.gameCode).toBeTruthy();
    expect(game.gameCode).toHaveLength(6);

    return game.gameCode;
}

/**
 * Helper to join a game as a player with avatar selection
 */
export async function joinAsPlayer(
    context: BrowserContext,
    config: PlayerJoinConfig
): Promise<Page> {
    const baseURL = process.env.BASE_URL || "http://localhost:3000";
    const { gameCode, playerName, avatarType = "emoji", languageCode } = config;

    const playerPage = await context.newPage();
    await playerPage.goto(`${baseURL}/play/${gameCode}`);
    await playerPage.waitForLoadState("domcontentloaded");

    // Fill in player name
    const nameInput = playerPage
        .locator('input[name="name"], input[placeholder*="name" i]')
        .first();
    await nameInput.waitFor({ timeout: 10000 });
    await nameInput.fill(playerName);

    // Select avatar
    if (avatarType === "emoji") {
        const emojiButtons = playerPage.getByRole("button", {
            name: /😀|😎|🤖|👾|🦊|🐱|🐶|🎮|🎯|⚡/,
        });
        const count = await emojiButtons.count();
        if (count > 0) {
            await emojiButtons.first().click();
        }
    }

    // Select language if specified (before clicking Join)
    if (languageCode) {
        await selectLanguageOnJoin(playerPage, languageCode);
        await playerPage.waitForTimeout(100); // Brief wait to ensure selection persists
    }

    // Join the game
    await playerPage.getByRole("button", { name: /join/i }).click();

    // Wait for join to complete
    await playerPage.waitForTimeout(2000);

    return playerPage;
}

/**
 * Waits for socket connection to be established
 */
export async function waitForSocketConnection(
    page: Page,
    timeout: number = 10000
): Promise<void> {
    // Wait for any socket-related content to appear
    await page.waitForFunction(
        () => {
            // Check if socket.io is loaded
            return (window as any).io !== undefined;
        },
        { timeout }
    );
}

/**
 * Waits for a specific game state
 */
export async function waitForGameState(
    page: Page,
    expectedStatus: GameStatus,
    timeout: number = 15000
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        // Check for visual indicators of the game state
        const hasWaitingIndicator = await page.getByText(/waiting for players/i).count();
        const hasActiveIndicator = await page.getByText(/get ready|question/i).count();
        const hasFinishedIndicator = await page.getByText(/final|game over/i).count();

        if (expectedStatus === "WAITING" && hasWaitingIndicator > 0) return;
        if (expectedStatus === "ACTIVE" && hasActiveIndicator > 0) return;
        if (expectedStatus === "FINISHED" && hasFinishedIndicator > 0) return;

        await page.waitForTimeout(500);
    }

    throw new Error(`Timeout waiting for game state: ${expectedStatus}`);
}

/**
 * Captures a screenshot with a descriptive name
 */
export async function captureScreenshot(
    page: Page,
    name: string
): Promise<void> {
    await page.screenshot({
        path: `test-results/screenshots/${name}-${Date.now()}.png`,
        fullPage: true,
    });
}

/**
 * Waits for a player to be admitted to the game
 */
export async function waitForAdmission(
    playerPage: Page,
    timeout: number = 15000
): Promise<void> {
    await expect(
        playerPage.getByText(/admitted|waiting for game to start/i)
    ).toBeVisible({ timeout });
}

/**
 * Submits an answer as a player
 * Based on the actual UI code, answer buttons are plain <button> elements
 * with a <span> containing the letter (A, B, C, D) as the first child
 */
export async function submitAnswer(
    playerPage: Page,
    answerIndex: number = 0
): Promise<void> {
    // Wait for the question to be displayed
    await playerPage.waitForTimeout(1000);

    // The answer buttons contain a span with the letter (A, B, C, D)
    // We'll target buttons that have these letters
    const letters = ['A', 'B', 'C', 'D'];
    const targetLetter = letters[answerIndex] || 'A';

    // Find all buttons on the page
    const allButtons = playerPage.locator('button');
    const buttonCount = await allButtons.count();

    // Look for a button that contains the target letter as its first span
    for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent();

        // Check if this button starts with our target letter
        // The UI renders like "A Answer text here"
        if (text && text.trim().startsWith(targetLetter)) {
            await button.click();
            await playerPage.waitForTimeout(300);
            return;
        }
    }

    // Fallback: just click the nth button if we can't find by letter
    console.warn(`Could not find answer button with letter ${targetLetter}, using fallback`);
    if (buttonCount > answerIndex) {
        await allButtons.nth(answerIndex).click();
        await playerPage.waitForTimeout(300);
    }
}

/**
 * Uses the hint powerup if available
 */
export async function useHintPowerUp(playerPage: Page): Promise<boolean> {
    try {
        // Look for the Hint button
        const hintButton = playerPage.getByRole('button', { name: /hint/i }).filter({ hasText: /left/ });

        if (await hintButton.count() > 0) {
            const isEnabled = await hintButton.first().isEnabled();
            if (isEnabled) {
                await hintButton.first().click();
                await playerPage.waitForTimeout(800);

                // Try multiple strategies to close the hint modal
                // Strategy 1: Look for Close button by role and text
                let closeButton = playerPage.getByRole('button', { name: /close/i });
                if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await closeButton.click();
                    await playerPage.waitForTimeout(300);
                    return true;
                }

                // Strategy 2: Look for any button with "Close" text in the dialog
                closeButton = playerPage.locator('button:has-text("Close")').last();
                if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
                    await closeButton.click();
                    await playerPage.waitForTimeout(300);
                    return true;
                }

                // Strategy 3: Press Escape key to close dialog
                await playerPage.keyboard.press('Escape');
                await playerPage.waitForTimeout(300);

                return true;
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Uses the double points powerup if available
 */
export async function useDoublePointsPowerUp(playerPage: Page): Promise<boolean> {
    try {
        // Look for the 2x button
        const doubleButton = playerPage.getByRole('button', { name: /2x/i }).filter({ hasText: /left/ });

        if (await doubleButton.count() > 0) {
            const isEnabled = await doubleButton.first().isEnabled();
            if (isEnabled) {
                await doubleButton.first().click();
                await playerPage.waitForTimeout(500);
                return true;
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

/**
 * Uses the copy answer powerup if available
 * Randomly selects a player to copy from
 */
export async function useCopyAnswerPowerUp(playerPage: Page): Promise<{ used: boolean; copiedFrom?: string }> {
    try {
        // Look for the Copy button
        const copyButton = playerPage.getByRole('button', { name: /copy/i }).filter({ hasText: /left/ });

        if (await copyButton.count() > 0) {
            const isEnabled = await copyButton.first().isEnabled();
            if (isEnabled) {
                await copyButton.first().click();
                await playerPage.waitForTimeout(1000);

                // Wait for the "Copy Answer" dialog to appear
                const dialogTitle = playerPage.locator('text="Copy Answer"');
                const dialogVisible = await dialogTitle.isVisible({ timeout: 2000 }).catch(() => false);

                if (!dialogVisible) {
                    return { used: false };
                }

                // Find player selection buttons within the dialog
                // These are buttons with w-full and justify-start classes
                // Filter to only include buttons that have a span (player name) to avoid matching other buttons
                const playerButtons = playerPage.locator('button.w-full.justify-start').filter({
                    has: playerPage.locator('span')
                });

                // Wait a moment for player list to fully load
                await playerPage.waitForTimeout(500);

                const count = await playerButtons.count();

                if (count === 0) {
                    // No other players available to copy from (shouldn't happen with 5 players)
                    await playerPage.keyboard.press('Escape');
                    await playerPage.waitForTimeout(300);
                    return { used: false };
                }

                if (count > 0) {
                    // Randomly select a player
                    const randomPlayerIndex = Math.floor(Math.random() * count);
                    const selectedButton = playerButtons.nth(randomPlayerIndex);

                    // Verify button is visible and enabled before clicking
                    const isButtonVisible = await selectedButton.isVisible().catch(() => false);
                    const isButtonEnabled = await selectedButton.isEnabled().catch(() => false);

                    if (!isButtonVisible || !isButtonEnabled) {
                        await playerPage.keyboard.press('Escape');
                        await playerPage.waitForTimeout(300);
                        return { used: false };
                    }

                    const playerName = await selectedButton.textContent();

                    // Click the player button
                    try {
                        await selectedButton.click({ timeout: 3000 });
                    } catch (clickError) {
                        await playerPage.keyboard.press('Escape');
                        await playerPage.waitForTimeout(300);
                        return { used: false };
                    }

                    // Wait for the dialog to close
                    await playerPage.waitForTimeout(1000);

                    // Verify the dialog actually closed
                    const dialogStillVisible = await dialogTitle.isVisible({ timeout: 500 }).catch(() => false);
                    if (dialogStillVisible) {
                        // Dialog didn't close, force it with Escape
                        await playerPage.keyboard.press('Escape');
                        await playerPage.waitForTimeout(300);
                    }

                    return { used: true, copiedFrom: playerName?.trim() };
                } else {
                    // No players available to copy from
                    await playerPage.keyboard.press('Escape');
                    await playerPage.waitForTimeout(300);
                    return { used: false };
                }
            }
        }
        return { used: false };
    } catch (error) {
        // Ensure dialog is closed on error
        await playerPage.keyboard.press('Escape').catch(() => {});
        await playerPage.waitForTimeout(300);
        return { used: false };
    }
}

/**
 * Randomly decides whether to use powerups and which ones
 * @param playerPage - The player's page
 * @param usageChance - Probability (0-1) of using each powerup (default: 0.3 = 30% chance)
 */
export async function useRandomPowerUps(
    playerPage: Page,
    usageChance: number = 0.3
): Promise<{ hint: boolean; copy: boolean; double: boolean; copiedFrom?: string }> {
    const result = {
        hint: false,
        copy: false,
        double: false,
        copiedFrom: undefined as string | undefined,
    };

    // Randomly decide to use hint (30% chance by default)
    if (Math.random() < usageChance) {
        result.hint = await useHintPowerUp(playerPage);
    }

    // Randomly decide to use copy (30% chance by default)
    if (Math.random() < usageChance) {
        const copyResult = await useCopyAnswerPowerUp(playerPage);
        result.copy = copyResult.used;
        result.copiedFrom = copyResult.copiedFrom;
    }

    // Randomly decide to use double points (30% chance by default)
    if (Math.random() < usageChance) {
        result.double = await useDoublePointsPowerUp(playerPage);
    }

    return result;
}

/**
 * Submits a random answer as a player
 * This function finds all available answer buttons and randomly selects one
 */
export async function submitRandomAnswer(playerPage: Page): Promise<{ letter: string; index: number }> {
    // Wait for the question to be displayed
    await playerPage.waitForTimeout(1500);

    // Find all buttons on the page
    const allButtons = playerPage.locator('button');
    const buttonCount = await allButtons.count();

    // Collect all answer buttons (those starting with A, B, C, or D)
    const answerButtons: { button: any; letter: string; index: number }[] = [];
    const letters = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent();

        if (text) {
            const trimmedText = text.trim();
            for (const letter of letters) {
                // Check if button starts with letter followed by space or just the letter
                if (trimmedText.startsWith(letter + ' ') || trimmedText.startsWith(letter)) {
                    // Verify button is visible and enabled
                    const isVisible = await button.isVisible().catch(() => false);
                    const isEnabled = await button.isEnabled().catch(() => false);

                    if (isVisible && isEnabled) {
                        answerButtons.push({
                            button,
                            letter,
                            index: letters.indexOf(letter)
                        });
                        break;
                    }
                }
            }
        }
    }

    if (answerButtons.length === 0) {
        throw new Error('No answer buttons found on the page');
    }

    // Randomly select one of the available answer buttons
    const randomIndex = Math.floor(Math.random() * answerButtons.length);
    const selectedAnswer = answerButtons[randomIndex];

    // Click the button with retry logic
    try {
        await selectedAnswer.button.click({ timeout: 5000 });
        await playerPage.waitForTimeout(500);
    } catch (error) {
        throw new Error(`Failed to click answer button ${selectedAnswer.letter}: ${error}`);
    }

    return { letter: selectedAnswer.letter, index: selectedAnswer.index };
}

/**
 * Waits for the host to see a specific number of players
 */
export async function waitForPlayerCount(
    hostPage: Page,
    expectedCount: number,
    timeout: number = 15000
): Promise<void> {
    await expect(
        hostPage.getByText(new RegExp(`${expectedCount}.*player`, "i"))
    ).toBeVisible({ timeout });
}

/**
 * Waits for the question timer to expire
 * @param hostPage - The host control page
 * @param timeLimit - The time limit for the question in seconds (default: 30)
 */
export async function waitForTimerExpiry(
    hostPage: Page,
    timeLimit: number = 30
): Promise<void> {
    // Add a buffer to ensure timer has fully expired
    const waitTime = (timeLimit + 2) * 1000;
    console.log(`    ⏳ Waiting ${timeLimit}s for timer to expire...`);
    await hostPage.waitForTimeout(waitTime);
    console.log(`    ✓ Timer expired`);
}

/**
 * Verifies how many players have submitted answers on the host control panel
 * @param hostPage - The host control page
 * @returns Object with answered count and total count
 */
export async function checkPlayerAnswers(hostPage: Page): Promise<{ answered: number; total: number }> {
    // Use more specific selectors to find the answer count
    // First try to find the "X of Y players answered" text
    const playersAnsweredText = await hostPage.locator('text=/\\d+ of \\d+ players answered/i').textContent().catch(() => null);

    if (playersAnsweredText) {
        const match = playersAnsweredText.match(/(\d+)\s+of\s+(\d+)/i);
        if (match) {
            return {
                answered: parseInt(match[1]),
                total: parseInt(match[2])
            };
        }
    }

    // Fallback: Look for the "Answered" section with the count
    const bodyText = await hostPage.textContent('body');
    const answeredMatch = bodyText?.match(/Answered\s*(\d+)\s*\/\s*(\d+)/i);
    if (answeredMatch) {
        return {
            answered: parseInt(answeredMatch[1]),
            total: parseInt(answeredMatch[2])
        };
    }

    return { answered: 0, total: 0 };
}

/**
 * Shows the results for the current question
 * Clicks the "Show Results" or "Reveal" button on the host control
 */
export async function showQuestionResults(hostPage: Page): Promise<void> {
    // Look for reveal/show results button
    const revealButton = hostPage.getByRole("button", {
        name: /reveal|show results/i
    });

    if (await revealButton.count() > 0) {
        await revealButton.first().click();
        await hostPage.waitForTimeout(2000);
        console.log("    ✓ Results displayed");
    } else {
        console.log("    ℹ No reveal button found (may be auto-revealed)");
    }
}

/**
 * Advances to the next question as host
 */
export async function hostNextQuestion(hostPage: Page): Promise<void> {
    const nextButton = hostPage.getByRole("button", {
        name: /next question|next/i,
    });
    await nextButton.click();
    await hostPage.waitForTimeout(1000); // Allow for transition
}

/**
 * Reveals answers as host
 */
export async function hostRevealAnswers(hostPage: Page): Promise<void> {
    const revealButton = hostPage.getByRole("button", { name: /reveal/i });
    if (await revealButton.count()) {
        await revealButton.click();
        await hostPage.waitForTimeout(500);
    }
}

/**
 * Starts the game as host
 */
export async function hostStartGame(hostPage: Page): Promise<void> {
    // Wait for start button to appear and be enabled
    const startButton = hostPage.getByRole("button", { name: /start game/i });

    // Wait for button to exist
    await expect(startButton).toBeVisible({ timeout: 30000 });

    // Wait for button to be enabled (requires players)
    await expect(startButton).toBeEnabled({ timeout: 30000 });

    // Click the button
    await startButton.click();

    // Wait for game to transition away from WAITING state
    await hostPage.waitForTimeout(3000);
}

/**
 * Cleans up test data by deleting a quiz
 */
export async function cleanupQuiz(
    page: Page,
    quizId: string
): Promise<void> {
    const baseURL = process.env.BASE_URL || "http://localhost:3000";

    try {
        await page.request.delete(`${baseURL}/api/quizzes/${quizId}`);
    } catch (error) {
        console.warn(`Failed to cleanup quiz ${quizId}:`, error);
    }
}

/**
 * Gets the current score for a player from the scoreboard
 */
export async function getPlayerScore(
    page: Page,
    playerName: string
): Promise<number | null> {
    const scoreElement = page.locator(`text=${playerName}`).locator("..");
    if (await scoreElement.count()) {
        const text = await scoreElement.textContent();
        const match = text?.match(/(\d+)\s*points?/i);
        return match ? parseInt(match[1]) : null;
    }
    return null;
}

/**
 * Checks if certificate download button is visible for players
 * @param playerPages - Array of player pages to check
 * @returns Number of players who can see the certificate download button
 */
export async function checkCertificateAvailability(
    playerPages: Page[]
): Promise<number> {
    let availableCount = 0;

    for (let i = 0; i < playerPages.length; i++) {
        const playerPage = playerPages[i];

        // Wait a bit for the final results screen to load
        await playerPage.waitForTimeout(1000);

        // Look for certificate download button
        const certButton = playerPage.locator('button').filter({
            hasText: /download certificate|certificate/i
        }).first();

        const isVisible = await certButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (isVisible) {
            availableCount++;
            console.log(`      Player ${i + 1}: Certificate available ✓`);
        } else {
            console.log(`      Player ${i + 1}: No certificate button`);
        }
    }

    return availableCount;
}

/**
 * Simulates certificate download for a random subset of players
 * Note: Actual file download is not verified, only button click
 * @param playerPages - Array of player pages
 * @param downloadChance - Probability (0-1) that each player will download (default: 0.5)
 */
export async function simulateCertificateDownloads(
    playerPages: Page[],
    downloadChance: number = 0.5
): Promise<number> {
    let downloadCount = 0;

    for (let i = 0; i < playerPages.length; i++) {
        const playerPage = playerPages[i];

        // Randomly decide if this player downloads their certificate
        if (Math.random() < downloadChance) {
            const certButton = playerPage.locator('button').filter({
                hasText: /download certificate|certificate/i
            }).first();

            const isVisible = await certButton.isVisible({ timeout: 2000 }).catch(() => false);

            if (isVisible) {
                try {
                    // Click the download button
                    // Note: This triggers a download but we don't verify the file
                    await certButton.click({ timeout: 3000 });
                    downloadCount++;
                    console.log(`      Player ${i + 1}: Downloaded certificate 📄`);

                    // Small delay to allow download to initiate
                    await playerPage.waitForTimeout(500);
                } catch (error) {
                    console.log(`      Player ${i + 1}: Failed to download certificate`);
                }
            }
        }
    }

    return downloadCount;
}

/**
 * Permanently deletes a quiz from the database (hard delete)
 * This removes the quiz, all questions, answers, translations, game sessions, and related data
 * @param page - Browser page instance
 * @param quizId - The ID of the quiz to delete
 */
export async function deleteQuiz(page: Page, quizId: string): Promise<void> {
    try {
        const baseURL = process.env.BASE_URL || "http://localhost:3000";

        // Call the hard-delete API endpoint (permanent deletion)
        // Use page.request instead of page.evaluate to avoid browser context issues
        const response = await page.request.post(`${baseURL}/api/quizzes/${quizId}/hard-delete`);

        if (response.ok()) {
            console.log(`   ✓ Quiz and all related data permanently deleted`);
        } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.log(`   ⚠️  Failed to delete quiz ${quizId}: ${response.status()} - ${errorText}`);
        }
    } catch (error) {
        console.log(`   ⚠️  Error deleting quiz ${quizId}:`, error);
    }
}

/**
 * Adds translations to a quiz for testing
 * Creates mock translations with language prefixes for easy verification
 * @param page - Browser page instance
 * @param quizId - The ID of the quiz to add translations to
 * @param languages - Array of language codes (e.g., ['es', 'fr'])
 * @returns Success status
 */
export async function addTranslationsToQuiz(
    page: Page,
    quizId: string,
    languages: string[]
): Promise<boolean> {
    try {
        const baseURL = process.env.BASE_URL || "http://localhost:3000";

        // Fetch the quiz with all questions and answers
        const quizRes = await page.request.get(`${baseURL}/api/quizzes/${quizId}`);
        if (!quizRes.ok()) {
            console.log(`   ⚠️  Failed to fetch quiz for translations`);
            return false;
        }

        const quiz = await quizRes.json();

        // For each language, create translations for all questions and answers
        for (const languageCode of languages) {
            const langPrefix = `[${languageCode.toUpperCase()}]`;

            for (const question of quiz.questions) {
                // Prepare answer translations
                const answerTranslations = question.answers.map((answer: any) => ({
                    id: answer.id,
                    answerText: `${langPrefix} ${answer.answerText}`,
                }));

                // Create question and answer translations in one request
                const translationData = {
                    questionText: `${langPrefix} ${question.questionText}`,
                    hostNotes: question.hostNotes ? `${langPrefix} ${question.hostNotes}` : null,
                    hint: question.hint ? `${langPrefix} ${question.hint}` : null,
                    easterEggButtonText: question.easterEggButtonText ? `${langPrefix} ${question.easterEggButtonText}` : null,
                    answers: answerTranslations,
                };

                const translationRes = await page.request.put(
                    `${baseURL}/api/quizzes/${quizId}/questions/${question.id}/translations/${languageCode}`,
                    { data: translationData }
                );

                if (!translationRes.ok()) {
                    console.log(`   ⚠️  Failed to add ${languageCode} translation for question ${question.id}`);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.log(`   ⚠️  Error adding translations:`, error);
        return false;
    }
}

/**
 * Selects a language on the join screen
 * Handles shadcn Select component interaction
 * @param playerPage - The player's page
 * @param languageCode - Language code to select (e.g., 'es', 'fr')
 * @returns Success status
 */
export async function selectLanguageOnJoin(
    playerPage: Page,
    languageCode: string
): Promise<boolean> {
    try {
        // Wait a bit for the page to fully load and API calls to complete
        await playerPage.waitForTimeout(1500);

        // Look for the label text to confirm selector is present
        const labelVisible = await playerPage.locator('text=Select Quiz Questions/Answer Language')
            .isVisible({ timeout: 3000 })
            .catch(() => false);

        if (!labelVisible) {
            console.log(`   ⚠️  Language selector not found (quiz may not have translations)`);
            return false;
        }

        // Find the SelectTrigger button - it should be visible next to the label
        const selectTrigger = playerPage.locator('button[role="combobox"]').first();

        // Check if language selector exists
        const selectorExists = await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false);

        if (!selectorExists) {
            console.log(`   ⚠️  Language selector trigger not found`);
            return false;
        }

        // Click the select trigger to open dropdown
        await selectTrigger.click();
        await playerPage.waitForTimeout(1200);

        // Wait for the dropdown content to be visible
        await playerPage.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

        // Map language codes to native names (same approach as mid-game switching)
        const languageMap: Record<string, string> = {
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'he': 'עברית',
            'ja': '日本語',
            'zh-CN': '简体中文',
            'ar': 'العربية',
            'pt': 'Português',
            'ru': 'Русский',
            'it': 'Italiano',
            'en': 'English'
        };
        const nativeName = languageMap[languageCode] || languageCode;

        // Find the option by its text content (native name)
        const languageOption = playerPage.locator(`[role="option"]:has-text("${nativeName}")`).first();

        // Wait for the specific option to be visible
        const optionVisible = await languageOption.isVisible({ timeout: 4000 }).catch(() => false);

        if (!optionVisible) {
            // Debug: log all available options
            const allOptions = await playerPage.locator('[role="option"]').count();
            console.log(`   ⚠️  Language option ${languageCode} (${nativeName}) not found (${allOptions} options available)`);

            // Close the dropdown
            await playerPage.keyboard.press('Escape');
            return false;
        }

        await languageOption.click();
        await playerPage.waitForTimeout(500);

        return true;
    } catch (error) {
        console.log(`   ⚠️  Error selecting language:`, error);
        return false;
    }
}

/**
 * Verifies that translated content is displayed on the player's screen
 * @param playerPage - The player's page
 * @param expectedPrefix - Expected language prefix (e.g., '[ES]', '[FR]')
 * @returns True if translations are displayed correctly
 */
export async function verifyTranslatedContent(
    playerPage: Page,
    expectedPrefix: string
): Promise<boolean> {
    try {
        // Wait a moment for content to render
        await playerPage.waitForTimeout(1000);

        // Check if question text contains the prefix
        const pageText = await playerPage.textContent('body');

        if (!pageText) {
            console.log(`   ⚠️  Page content is empty`);
            return false;
        }

        // Verify the prefix appears in the content
        if (pageText.includes(expectedPrefix)) {
            return true;
        }

        console.log(`   ⚠️  Expected prefix ${expectedPrefix} not found in content`);
        return false;
    } catch (error) {
        console.log(`   ⚠️  Error verifying translated content:`, error);
        return false;
    }
}

/**
 * Switches language during gameplay using the bottom-right selector
 * @param playerPage - The player's page
 * @param languageCode - Language code to switch to (e.g., 'es', 'fr')
 * @returns Success status
 */
export async function switchLanguageDuringGame(
    playerPage: Page,
    languageCode: string
): Promise<boolean> {
    try {
        // Wait for game to be fully loaded
        await playerPage.waitForTimeout(1000);

        // Find the collapsible language selector at bottom-right (fixed position)
        const collapsibleTrigger = playerPage.locator('.fixed.bottom-4.right-4 button').first();

        // Check if collapsed language selector exists
        const triggerExists = await collapsibleTrigger.isVisible({ timeout: 3000 }).catch(() => false);

        if (!triggerExists) {
            console.log(`   ⚠️  Language switcher not found during game`);
            return false;
        }

        // Click to expand the language selector
        await collapsibleTrigger.click();
        await playerPage.waitForTimeout(800);

        // Find and click the language button by looking for the native language name
        const languageMap: Record<string, string> = {
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'he': 'עברית',
            'ja': '日本語',
            'zh-CN': '简体中文',
            'ar': 'العربية',
            'pt': 'Português',
            'ru': 'Русский',
            'it': 'Italiano',
            'en': 'English'
        };
        const nativeName = languageMap[languageCode] || languageCode;

        const languageButton = playerPage.locator(`button:has-text("${nativeName}")`).first();

        const buttonVisible = await languageButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (!buttonVisible) {
            console.log(`   ⚠️  Language button for ${languageCode} (${nativeName}) not found`);
            return false;
        }

        await languageButton.click();
        await playerPage.waitForTimeout(800);

        return true;
    } catch (error) {
        console.log(`   ⚠️  Error switching language during game:`, error);
        return false;
    }
}
