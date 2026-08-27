/*
    TMS6124 WEB AUTHORING PROJECT
    FILE: js/app.js

    MAIN IDEA OF THIS FILE:
    1. Load xml/pickleball.xml using fetch().
    2. Parse the XML text into an XML DOM using DOMParser.
    3. Perform CREATE, READ, UPDATE and DELETE on XML DOM nodes.
    4. Refresh the HTML display from the current XML DOM.
    5. Use XMLSerializer to turn the changed DOM back into XML text.
    6. Download/import XML so changes can be preserved.

    IMPORTANT FOR LECTURER EXPLANATION:
    - xmlDoc is the MAIN source of tournament data after the XML is loaded.
    - HTML tables are only a display of xmlDoc.
    - We do NOT hard-code the player dataset in index.html.
    - We do NOT use a JavaScript array as the main database.

    EASY CHANGES:
    - XML filename: change XML_FILE below.
    - Player XML fields: see createPlayerNode(), updatePlayerFromForm(),
      renderPlayers(), and exportToExcel().
    - Display wording: mostly change index.html.
    - Colours/layout: change css/style.css.
*/

"use strict";

// ============================================================================
// 1. APPLICATION SETTINGS AND GLOBAL VARIABLES
// ============================================================================

// Relative path works on GitHub Pages, XAMPP, Live Server and other web servers.
const XML_FILE = "xml/pickleball.xml";

// localStorage key is only a browser convenience. Required persistence is XML export.
const LOCAL_STORAGE_KEY = "tms6124_pickleball_xml";

// This variable will hold the parsed XML Document (XML DOM tree).
let xmlDoc = null;

// Keep a copy of the original XML text so Reset can restore the starting data.
let originalXmlText = "";

// ============================================================================
// 2. SMALL HELPER FUNCTIONS
//    These avoid repeating the same DOM code in many places.
// ============================================================================

/**
 * PURPOSE: Shorter version of document.getElementById().
 * EXAMPLE: byId("playerCount") returns the element with id="playerCount".
 */
function byId(id) {
    return document.getElementById(id);
}

/**
 * PURPOSE: Safely read the text inside the first child tag.
 * EXAMPLE: getChildText(player, "Name") returns the player's name.
 */
function getChildText(parentNode, tagName) {
    const child = parentNode.getElementsByTagName(tagName)[0];
    return child ? child.textContent.trim() : "";
}

/**
 * PURPOSE: Change or create the text of one child element in an XML node.
 * USED BY: UPDATE operation.
 */
function setChildText(parentNode, tagName, value) {
    let child = parentNode.getElementsByTagName(tagName)[0];

    // If the element does not exist, create it so the XML remains complete.
    if (!child) {
        child = xmlDoc.createElement(tagName);
        parentNode.appendChild(child);
    }

    child.textContent = value;
}

/**
 * PURPOSE: Create a simple XML element such as <Name>Ali</Name>.
 * USED BY: CREATE operation.
 */
function createTextElement(tagName, value) {
    const element = xmlDoc.createElement(tagName);
    element.textContent = value;
    return element;
}

/**
 * PURPOSE: Find one player by its PlayerID attribute.
 * WHY LOOP: Keeps the code easy to understand and avoids complex selectors.
 */
function findPlayerById(playerId) {
    const players = xmlDoc.getElementsByTagName("Player");

    for (const player of players) {
        if (player.getAttribute("PlayerID") === playerId) {
            return player;
        }
    }

    return null;
}

/**
 * PURPOSE: Show feedback to the user after an action.
 * error=true changes the text style for error messages.
 */
function showMessage(message, error = false) {
    const box = byId("messageBox");
    box.textContent = message;
    box.classList.add("show");
    box.classList.toggle("error", error);

    // Clear the message after 4 seconds so the interface stays tidy.
    window.setTimeout(() => {
        box.textContent = "";
        box.classList.remove("show", "error");
    }, 4000);
}

/**
 * PURPOSE: Convert the current XML DOM into formatted XML text.
 * REQUIRED CONCEPT: XMLSerializer.
 */
function serializeXml() {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

/**
 * PURPOSE: Save the current XML text in this browser.
 * NOTE: This is extra convenience only; it does not replace XML export.
 */
function saveBrowserCopy() {
    if (!xmlDoc) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeXml());
}

// ============================================================================
// 3. LOAD AND PARSE XML
// ============================================================================

/**
 * TASK 1: XML DATA MODEL AND PARSING
 *
 * PURPOSE:
 * - fetch() downloads pickleball.xml from the web server.
 * - DOMParser converts the downloaded XML text into an XML DOM tree.
 *
 * IMPORTANT:
 * Opening index.html using file:// may block fetch(). Use GitHub Pages,
 * XAMPP, Live Server or another web server.
 */
async function loadXmlData() {
    try {
        // Download the original XML file from the project folder.
        const response = await fetch(XML_FILE, { cache: "no-store" });

        // Stop if the web server could not provide the file.
        if (!response.ok) {
            throw new Error(`Could not load ${XML_FILE}. HTTP ${response.status}`);
        }

        // Convert the response body into plain XML text.
        originalXmlText = await response.text();

        // If a previous browser copy exists, use it; otherwise use original XML.
        const browserCopy = localStorage.getItem(LOCAL_STORAGE_KEY);
        const xmlTextToUse = browserCopy || originalXmlText;

        // Parse XML text into the XML DOM tree used by the rest of the system.
        xmlDoc = parseXmlText(xmlTextToUse);

        // Populate interface and controls after XML is ready.
        populateClubSelect();
        refreshAllViews();

        showMessage(browserCopy ? "Saved browser XML loaded successfully." : "Original XML loaded successfully.");
    } catch (error) {
        console.error(error);
        showMessage(`XML loading error: ${error.message}`, true);
    }
}

/**
 * PURPOSE: Convert an XML string into a Document object.
 * Also checks for XML parser errors so broken imported XML is rejected.
 */
function parseXmlText(xmlText) {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(xmlText, "application/xml");

    // Browsers insert <parsererror> when XML is not well-formed.
    if (parsedDocument.getElementsByTagName("parsererror").length > 0) {
        throw new Error("The XML is not well-formed.");
    }

    return parsedDocument;
}

// ============================================================================
// 4. NAVIGATION AND THEME
// ============================================================================

/**
 * PURPOSE: Show one page-like section and hide the others.
 * This is a single-page application; the navigation does not reload the page.
 */
function showView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => {
        const shouldShow = view.id === viewId;
        view.hidden = !shouldShow;
        view.classList.toggle("active-view", shouldShow);
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.view === viewId);
    });
}

/**
 * PURPOSE: Switch between the two CSS variable themes.
 */
function toggleTheme() {
    const body = document.body;
    const button = byId("themeButton");
    const usingSunrise = body.dataset.theme === "sunrise";

    body.dataset.theme = usingSunrise ? "court-light" : "sunrise";
    button.setAttribute("aria-pressed", String(!usingSunrise));
}

// ============================================================================
// 5. READ / DISPLAY XML DATA
//    Everything below reads from xmlDoc and builds HTML from the current XML.
// ============================================================================

/**
 * PURPOSE: Refresh every visible data area after load/CRUD/import/reset.
 */
function refreshAllViews() {
    if (!xmlDoc) return;

    renderTournamentInfo();
    renderDashboardStatistics();
    renderGroupedSummaries();
    renderPlayers();
    renderConfirmedCategoryPlayers();
    renderMatches();
    renderPublicResults();
    previewSerializedXml();
}

/**
 * PURPOSE: Display Tournament information from the XML <Tournament> node.
 */
function renderTournamentInfo() {
    const tournament = xmlDoc.getElementsByTagName("Tournament")[0];
    const container = byId("tournamentInfo");

    // Fields shown on the dashboard. Values still come from XML.
    const fields = [
        ["Tournament ID", "TournamentID"],
        ["Name", "TournamentName"],
        ["Date", "Date"],
        ["Venue", "Venue"],
        ["Organiser", "Organiser"]
    ];

    container.innerHTML = "";

    fields.forEach(([label, xmlTag]) => {
        const wrapper = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");

        term.textContent = label;
        description.textContent = getChildText(tournament, xmlTag);

        wrapper.append(term, description);
        container.appendChild(wrapper);
    });
}

/**
 * PURPOSE: Count players, clubs, matches and confirmed players from XML.
 */
function renderDashboardStatistics() {
    const players = Array.from(xmlDoc.getElementsByTagName("Player"));
    const clubs = xmlDoc.getElementsByTagName("Club");
    const matches = xmlDoc.getElementsByTagName("Match");

    // filter() is only used temporarily to count data from the XML DOM.
    const confirmedPlayers = players.filter((player) => getChildText(player, "Status") === "Confirmed");

    byId("playerCount").textContent = players.length;
    byId("clubCount").textContent = clubs.length;
    byId("matchCount").textContent = matches.length;
    byId("confirmedCount").textContent = confirmedPlayers.length;
}

/**
 * PURPOSE: Display player counts grouped by Club and by Category.
 * This proves the XML data can support grouped tournament views.
 */
function renderGroupedSummaries() {
    const players = Array.from(xmlDoc.getElementsByTagName("Player"));

    renderCountList(byId("clubSummary"), players, "Club");
    renderCountList(byId("categorySummary"), players, "Category");
}

/**
 * PURPOSE: Reusable helper for grouped count displays.
 */
function renderCountList(container, players, fieldName) {
    const counts = new Map();

    players.forEach((player) => {
        const value = getChildText(player, fieldName);
        counts.set(value, (counts.get(value) || 0) + 1);
    });

    const list = document.createElement("ul");
    list.className = "summary-list";

    // Sort labels alphabetically so the output is predictable.
    [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, count]) => {
        const item = document.createElement("li");
        item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${count}</strong>`;
        list.appendChild(item);
    });

    container.innerHTML = "";
    container.appendChild(list);
}

/**
 * TASK 2: READ
 * PURPOSE: Read player nodes from the XML DOM and display them in a table.
 * Search/filter values only decide which XML nodes are shown.
 */
function renderPlayers() {
    const tableBody = byId("playersTableBody");
    const searchText = byId("playerSearch").value.trim().toLowerCase();
    const category = byId("categoryFilter").value;
    const status = byId("statusFilter").value;

    tableBody.innerHTML = "";

    const players = xmlDoc.getElementsByTagName("Player");

    for (const player of players) {
        const playerId = player.getAttribute("PlayerID");
        const name = getChildText(player, "Name");
        const club = getChildText(player, "Club");
        const playerCategory = getChildText(player, "Category");
        const playerStatus = getChildText(player, "Status");
        const fee = getChildText(player, "RegistrationFee");

        // Search across ID, name and club.
        const searchableText = `${playerId} ${name} ${club}`.toLowerCase();

        // Skip XML nodes that do not match the selected filters.
        if (searchText && !searchableText.includes(searchText)) continue;
        if (category && playerCategory !== category) continue;
        if (status && playerStatus !== status) continue;

        const row = document.createElement("tr");

        // Buttons store only the PlayerID; the real data stays in xmlDoc.
        row.innerHTML = `
            <td>${escapeHtml(playerId)}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(club)}</td>
            <td>${escapeHtml(playerCategory)}</td>
            <td><span class="status-badge ${statusClass(playerStatus)}">${escapeHtml(playerStatus)}</span></td>
            <td>RM ${escapeHtml(fee)}</td>
            <td>
                <div class="action-group">
                    <button class="button button-secondary button-small edit-player" type="button" data-player-id="${escapeHtml(playerId)}">Edit</button>
                    <button class="button button-danger button-small delete-player" type="button" data-player-id="${escapeHtml(playerId)}">Delete</button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    }

    // Event delegation: one listener handles all Edit/Delete buttons in the table.
    // The listener itself is attached once in attachEventListeners().
}

/**
 * PURPOSE: Required category filtering result.
 * Displays only players where Category = selected value AND Status = Confirmed.
 */
function renderConfirmedCategoryPlayers() {
    const selectedCategory = byId("confirmedCategoryFilter").value;
    const tableBody = byId("confirmedPlayersTableBody");
    tableBody.innerHTML = "";

    const players = xmlDoc.getElementsByTagName("Player");

    for (const player of players) {
        const category = getChildText(player, "Category");
        const status = getChildText(player, "Status");

        if (category !== selectedCategory || status !== "Confirmed") continue;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(player.getAttribute("PlayerID"))}</td>
            <td>${escapeHtml(getChildText(player, "Name"))}</td>
            <td>${escapeHtml(getChildText(player, "Club"))}</td>
            <td>${escapeHtml(category)}</td>
            <td>${escapeHtml(status)}</td>
        `;
        tableBody.appendChild(row);
    }

    if (!tableBody.children.length) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="5">No confirmed players found for this category.</td>`;
        tableBody.appendChild(row);
    }
}

/**
 * PURPOSE: Display court schedule and match information from XML.
 */
function renderMatches() {
    const tableBody = byId("matchesTableBody");
    tableBody.innerHTML = "";

    const matches = xmlDoc.getElementsByTagName("Match");

    for (const match of matches) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHtml(match.getAttribute("MatchID"))}</td>
            <td>${escapeHtml(getChildText(match, "Date"))}</td>
            <td>${escapeHtml(getChildText(match, "Time"))}</td>
            <td>${escapeHtml(getChildText(match, "Court"))}</td>
            <td>${escapeHtml(getChildText(match, "Category"))}</td>
            <td>${escapeHtml(getChildText(match, "Participant1"))}</td>
            <td>${escapeHtml(getChildText(match, "Participant2"))}</td>
            <td>${escapeHtml(getChildText(match, "Status"))}</td>
        `;
        tableBody.appendChild(row);
    }
}

/**
 * PURPOSE: Show completed match results for spectators/public users.
 */
function renderPublicResults() {
    const container = byId("resultsCards");
    container.innerHTML = "";

    const matches = xmlDoc.getElementsByTagName("Match");
    let completedCount = 0;

    for (const match of matches) {
        if (getChildText(match, "Status") !== "Completed") continue;

        completedCount += 1;

        const card = document.createElement("article");
        card.className = "result-card";
        card.innerHTML = `
            <p class="eyebrow">${escapeHtml(match.getAttribute("MatchID"))} • ${escapeHtml(getChildText(match, "Category"))}</p>
            <h3>${escapeHtml(getChildText(match, "Participant1"))} vs ${escapeHtml(getChildText(match, "Participant2"))}</h3>
            <p>${escapeHtml(getChildText(match, "Date"))} • ${escapeHtml(getChildText(match, "Court"))}</p>
            <p class="winner">Winner: ${escapeHtml(getChildText(match, "Winner"))}</p>
        `;

        container.appendChild(card);
    }

    if (completedCount === 0) {
        container.textContent = "No completed match results are available yet.";
    }
}

// ============================================================================
// 6. PLAYER FORM + CRUD OPERATIONS
// ============================================================================

/**
 * PURPOSE: Fill the Club dropdown from XML <Club> records.
 * This avoids hard-coding club choices in HTML.
 */
function populateClubSelect() {
    const select = byId("playerClubInput");
    select.innerHTML = "";

    const clubs = xmlDoc.getElementsByTagName("Club");

    for (const club of clubs) {
        const option = document.createElement("option");
        option.value = getChildText(club, "ClubName");
        option.textContent = getChildText(club, "ClubName");
        select.appendChild(option);
    }
}

/**
 * PURPOSE: Open an empty form for CREATE.
 */
function openNewPlayerForm() {
    byId("playerForm").reset();
    byId("editingPlayerId").value = "";
    byId("playerFormTitle").textContent = "Add New Player";
    byId("playerIdInput").disabled = false;
    byId("playerFeeInput").value = "30.00";
    byId("playerFormPanel").hidden = false;
    byId("playerIdInput").focus();
}

/**
 * PURPOSE: Open the form with existing XML values for UPDATE.
 */
function openEditPlayerForm(playerId) {
    const player = findPlayerById(playerId);

    if (!player) {
        showMessage("Player could not be found.", true);
        return;
    }

    byId("editingPlayerId").value = playerId;
    byId("playerFormTitle").textContent = `Edit Player ${playerId}`;
    byId("playerIdInput").value = playerId;
    byId("playerIdInput").disabled = true; // Keep primary ID stable during update.
    byId("playerNameInput").value = getChildText(player, "Name");
    byId("playerClubInput").value = getChildText(player, "Club");
    byId("playerCategoryInput").value = getChildText(player, "Category");
    byId("playerStatusInput").value = getChildText(player, "Status");
    byId("playerFeeInput").value = getChildText(player, "RegistrationFee");
    byId("playerFormPanel").hidden = false;
    byId("playerNameInput").focus();
}

/**
 * PURPOSE: Hide and clear the player form.
 */
function closePlayerForm() {
    byId("playerFormPanel").hidden = true;
    byId("playerForm").reset();
    byId("editingPlayerId").value = "";
    byId("playerIdInput").disabled = false;
}

/**
 * PURPOSE: Decide whether Save means CREATE or UPDATE.
 */
function handlePlayerFormSubmit(event) {
    event.preventDefault();

    const editingPlayerId = byId("editingPlayerId").value;

    if (editingPlayerId) {
        updatePlayerFromForm(editingPlayerId);
    } else {
        createPlayerFromForm();
    }
}

/**
 * TASK 2: CREATE
 * PURPOSE: Add a real <Player> node to the current XML DOM.
 */
function createPlayerFromForm() {
    const playerId = byId("playerIdInput").value.trim().toUpperCase();

    // Unique ID is required by the assignment.
    if (findPlayerById(playerId)) {
        showMessage(`Player ID ${playerId} already exists.`, true);
        return;
    }

    const newPlayer = createPlayerNode({
        playerId,
        name: byId("playerNameInput").value.trim(),
        club: byId("playerClubInput").value,
        category: byId("playerCategoryInput").value,
        status: byId("playerStatusInput").value,
        fee: Number(byId("playerFeeInput").value).toFixed(2)
    });

    // Append the new XML node inside the existing <Players> parent node.
    xmlDoc.getElementsByTagName("Players")[0].appendChild(newPlayer);

    afterCrudChange(`Player ${playerId} created successfully.`);
}

/**
 * PURPOSE: Build one complete <Player> XML node.
 * WHERE TO ADD A NEW PLAYER FIELD:
 * Add another appendChild(createTextElement(...)) line here, then also update
 * the XML, edit form, renderPlayers() and Excel export.
 */
function createPlayerNode(data) {
    const player = xmlDoc.createElement("Player");

    // PlayerID is stored as an XML attribute.
    player.setAttribute("PlayerID", data.playerId);

    // Other values are stored as child elements.
    player.appendChild(createTextElement("Name", data.name));
    player.appendChild(createTextElement("Club", data.club));
    player.appendChild(createTextElement("Category", data.category));
    player.appendChild(createTextElement("Status", data.status));
    player.appendChild(createTextElement("RegistrationFee", data.fee));

    return player;
}

/**
 * TASK 2: UPDATE
 * PURPOSE: Modify child elements inside an existing <Player> XML node.
 */
function updatePlayerFromForm(playerId) {
    const player = findPlayerById(playerId);

    if (!player) {
        showMessage("Player could not be found for update.", true);
        return;
    }

    // These calls change the XML DOM tree directly.
    setChildText(player, "Name", byId("playerNameInput").value.trim());
    setChildText(player, "Club", byId("playerClubInput").value);
    setChildText(player, "Category", byId("playerCategoryInput").value);
    setChildText(player, "Status", byId("playerStatusInput").value);
    setChildText(player, "RegistrationFee", Number(byId("playerFeeInput").value).toFixed(2));

    afterCrudChange(`Player ${playerId} updated successfully.`);
}

/**
 * TASK 2: DELETE
 * PURPOSE: Remove a <Player> node from the XML DOM.
 * Confirmation is shown before the destructive action as required.
 */
function deletePlayer(playerId) {
    const player = findPlayerById(playerId);

    if (!player) {
        showMessage("Player could not be found for deletion.", true);
        return;
    }

    const playerName = getChildText(player, "Name");
    const confirmed = window.confirm(`Delete ${playerId} - ${playerName}? This will remove the XML node from the current DOM.`);

    if (!confirmed) return;

    // removeChild() performs the DELETE on the XML DOM tree.
    player.parentNode.removeChild(player);

    afterCrudChange(`Player ${playerId} deleted successfully.`);
}

/**
 * PURPOSE: Common steps after CREATE, UPDATE or DELETE.
 * This keeps all interface views synchronized with the changed XML DOM.
 */
function afterCrudChange(message) {
    saveBrowserCopy();
    closePlayerForm();
    refreshAllViews();
    showMessage(message);
}

// ============================================================================
// 7. XML SERIALIZATION, DOWNLOAD, IMPORT AND RESET
// ============================================================================

/**
 * TASK 3: XMLSerializer PREVIEW
 * PURPOSE: Show the current XML DOM as XML text on screen.
 */
function previewSerializedXml() {
    if (!xmlDoc) return;
    byId("xmlPreview").textContent = serializeXml();
}

/**
 * TASK 3: PERSIST / SAVE
 * PURPOSE: Download the latest XML DOM as pickleball_updated.xml.
 */
function downloadUpdatedXml() {
    const xmlText = serializeXml();
    const blob = new Blob([xmlText], { type: "application/xml" });
    downloadBlob(blob, "pickleball_updated.xml");
    showMessage("Updated XML downloaded. Open it to verify the latest CRUD changes.");
}

/**
 * PURPOSE: Import a previously exported XML file and use it as the current DOM.
 * This demonstrates that saved changes can be reloaded.
 */
async function importSavedXml(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const xmlText = await file.text();
        xmlDoc = parseXmlText(xmlText);

        saveBrowserCopy();
        populateClubSelect();
        refreshAllViews();

        showMessage(`${file.name} imported successfully.`);
    } catch (error) {
        showMessage(`Import failed: ${error.message}`, true);
    } finally {
        // Allow the same file to be selected again later.
        event.target.value = "";
    }
}

/**
 * PURPOSE: Return to the original XML file from the server.
 */
function resetToOriginalXml() {
    const confirmed = window.confirm("Reset all browser changes and reload the original pickleball.xml data?");
    if (!confirmed) return;

    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        xmlDoc = parseXmlText(originalXmlText);
        populateClubSelect();
        refreshAllViews();
        closePlayerForm();
        showMessage("Original XML restored.");
    } catch (error) {
        showMessage(`Reset failed: ${error.message}`, true);
    }
}

/**
 * PURPOSE: Generic browser download helper used by XML and CSV fallback.
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Release the temporary browser URL after the download begins.
    URL.revokeObjectURL(url);
}

// ============================================================================
// 8. EXTRA FEATURE: EXPORT CURRENT XML DATA TO EXCEL
// ============================================================================

/**
 * PURPOSE: Export Tournament, Players and Matches into an .xlsx workbook.
 * IMPORTANT: Data is read from the CURRENT XML DOM, so CRUD changes are included.
 *
 * If SheetJS CDN is unavailable, a CSV fallback is downloaded instead.
 */
function exportToExcel() {
    if (typeof XLSX === "undefined") {
        exportPlayersCsvFallback();
        showMessage("Excel library unavailable. Player data was exported as CSV instead.");
        return;
    }

    const tournament = xmlDoc.getElementsByTagName("Tournament")[0];

    // Each worksheet array is created temporarily from xmlDoc for export only.
    const tournamentRows = [
        ["Field", "Value"],
        ["Tournament ID", getChildText(tournament, "TournamentID")],
        ["Tournament Name", getChildText(tournament, "TournamentName")],
        ["Date", getChildText(tournament, "Date")],
        ["Venue", getChildText(tournament, "Venue")],
        ["Organiser", getChildText(tournament, "Organiser")]
    ];

    const playerRows = [["Player ID", "Name", "Club", "Category", "Status", "Registration Fee (RM)"]];
    for (const player of xmlDoc.getElementsByTagName("Player")) {
        playerRows.push([
            player.getAttribute("PlayerID"),
            getChildText(player, "Name"),
            getChildText(player, "Club"),
            getChildText(player, "Category"),
            getChildText(player, "Status"),
            Number(getChildText(player, "RegistrationFee"))
        ]);
    }

    const matchRows = [["Match ID", "Date", "Time", "Court", "Category", "Participant 1", "Participant 2", "Status", "Winner"]];
    for (const match of xmlDoc.getElementsByTagName("Match")) {
        matchRows.push([
            match.getAttribute("MatchID"),
            getChildText(match, "Date"),
            getChildText(match, "Time"),
            getChildText(match, "Court"),
            getChildText(match, "Category"),
            getChildText(match, "Participant1"),
            getChildText(match, "Participant2"),
            getChildText(match, "Status"),
            getChildText(match, "Winner")
        ]);
    }

    // Create a workbook and three worksheets.
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(tournamentRows), "Tournament Info");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(playerRows), "Players");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matchRows), "Matches");

    // Browser downloads the final Excel workbook.
    XLSX.writeFile(workbook, "Pickleball_Tournament_Data.xlsx");
    showMessage("Excel workbook exported from the current XML DOM.");
}

/**
 * PURPOSE: Simple backup export if the optional Excel CDN cannot load.
 */
function exportPlayersCsvFallback() {
    const rows = [["Player ID", "Name", "Club", "Category", "Status", "Registration Fee (RM)"]];

    for (const player of xmlDoc.getElementsByTagName("Player")) {
        rows.push([
            player.getAttribute("PlayerID"),
            getChildText(player, "Name"),
            getChildText(player, "Club"),
            getChildText(player, "Category"),
            getChildText(player, "Status"),
            getChildText(player, "RegistrationFee")
        ]);
    }

    // Quote every field so commas inside names/club names do not break the CSV.
    const csvText = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadBlob(new Blob([csvText], { type: "text/csv;charset=utf-8" }), "Pickleball_Players.csv");
}

// ============================================================================
// 9. DISPLAY-SAFETY HELPERS
// ============================================================================

/**
 * PURPOSE: Convert text into safe HTML before placing XML values in innerHTML.
 */
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * PURPOSE: Choose a CSS class for the registration status badge.
 */
function statusClass(status) {
    if (status === "Confirmed") return "status-confirmed";
    if (status === "Pending") return "status-pending";
    return "status-withdrawn";
}

// ============================================================================
// 10. EVENT LISTENERS
//     All button/input events are connected in one place for easy lecturer review.
// ============================================================================

function attachEventListeners() {
    // Main navigation buttons.
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.view));
    });

    // Theme and dashboard controls.
    byId("themeButton").addEventListener("click", toggleTheme);
    byId("refreshButton").addEventListener("click", refreshAllViews);

    // Player CREATE / UPDATE form controls.
    byId("newPlayerButton").addEventListener("click", openNewPlayerForm);
    byId("cancelPlayerButton").addEventListener("click", closePlayerForm);
    byId("playerForm").addEventListener("submit", handlePlayerFormSubmit);

    // READ filters: redraw player table whenever a filter changes.
    byId("playerSearch").addEventListener("input", renderPlayers);
    byId("categoryFilter").addEventListener("change", renderPlayers);
    byId("statusFilter").addEventListener("change", renderPlayers);
    byId("confirmedCategoryFilter").addEventListener("change", renderConfirmedCategoryPlayers);

    // One listener handles Edit and Delete buttons created inside the player table.
    byId("playersTableBody").addEventListener("click", (event) => {
        const editButton = event.target.closest(".edit-player");
        const deleteButton = event.target.closest(".delete-player");

        if (editButton) {
            openEditPlayerForm(editButton.dataset.playerId);
        }

        if (deleteButton) {
            deletePlayer(deleteButton.dataset.playerId);
        }
    });

    // Task 3 serialization / persistence controls.
    byId("previewXmlButton").addEventListener("click", previewSerializedXml);
    byId("downloadXmlButton").addEventListener("click", downloadUpdatedXml);
    byId("importXmlInput").addEventListener("change", importSavedXml);
    byId("resetButton").addEventListener("click", resetToOriginalXml);

    // Extra Excel export.
    byId("excelButton").addEventListener("click", exportToExcel);
}

// ============================================================================
// 11. APPLICATION STARTUP
// ============================================================================

/**
 * PURPOSE: Start the project once the deferred script runs.
 */
function startApplication() {
    attachEventListeners();
    loadXmlData();
}

// Run the application.
startApplication();
