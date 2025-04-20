let recognition;
let isRecognizing = false;
let lastCommand = '';
let currentRowIndex = null;
let processingFlg = 0

// ボタン初期状態設定
enabledStartButton();

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('このブラウザはSpeechRecognition APIに対応していません。');
        return null;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'ja-JP';
    recognizer.continuous = true;
    recognizer.interimResults = true;

    recognizer.onresult = function (event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
            console.log(event.results[i][0].transcript)
        }

        document.getElementById('speech-output').textContent = transcript;

        // 「次」→ 行追加
        if (!processingFlg && transcript.includes("次") && !isBlankLastRow()) {
            transcript = '';
            processingFlg = 1;
            setTimeout(() => {
                addRow();
                processingFlg = 0;
            }, 1);
            return;
        }

        // 「次」という単語の前の部分を削除
        const transcriptForMatch = removeBeforeWord(transcript);

        // 数値の抽出
        const cmMatch = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(cm|CM|センチ)/);
        const gMatch = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(g|G|グラム)/);

        if (!processingFlg && (cmMatch || gMatch)) {
            const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
            if (currentRowIndex === null) {
                // 行が存在しなければ追加
                addRow();
            }

            const rows = table.getElementsByTagName('tr');
            const targetRow = rows[currentRowIndex] || rows[rows.length - 1];
            if (cmMatch) {
                targetRow.cells[0].textContent = cmMatch[1]; // 長さ
            }
            if (gMatch) {
                targetRow.cells[1].textContent = gMatch[1]; // 重さ
            }
        }

    };

    recognizer.onerror = function (event) {
        console.error('SpeechRecognition Error:', event.error);
    };

    recognizer.onend = function () {
        if (isRecognizing) {
            recognizer.start(); // 自動再開
        }
    };

    return recognizer;
}

function startRecognition() {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }
    if (recognition && !isRecognizing) {
        recognition.start();
        disabledStartButton();
        addRow();
        isRecognizing = true;
        console.log('音声認識を開始しました');
    }
}

function stopRecognition() {
    if (recognition && isRecognizing) {
        recognition.stop();
        enabledStartButton();
        isRecognizing = false;
        console.log('音声認識を停止しました');
    }
}

function isBlankLastRow() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const rows = table.getElementsByTagName('tr');
    const targetRow = rows[currentRowIndex] || rows[rows.length - 1];
    return !targetRow.cells[0].textContent || !targetRow.cells[1].textContent
}

function addRow() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();
    const cell1 = newRow.insertCell(0);
    const cell2 = newRow.insertCell(1);
    cell1.textContent = "";
    cell2.textContent = "";
    currentRowIndex = table.rows.length - 1; // 新しく追加された行を対象に
}

function removeBeforeWord(text, keyword = '次') {
    const index = text.lastIndexOf(keyword);
    if (index !== -1) {
        return text.slice(index); // 「次」以降を残す
    } else {
        return text; // 「次」がない場合はそのまま返す
    }
}

function downloadCSV() {
    const table = document.getElementById("data-table");
    let csv = "Length,Weight\n"; // ヘッダー行

    const tbodyRows = table.tBodies[0].rows;

    for (let row of tbodyRows) {
        const length = row.cells[0].textContent.trim().replace(/[^\d.]/g, "");
        const weight = row.cells[1].textContent.trim().replace(/[^\d.]/g, "");

        const lengthVal = length || "0";
        const weightVal = weight || "0";

        csv += `${lengthVal},${weightVal}\n`;
    }

    // ▼ 日付＆時刻付きファイル名の生成
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${y}-${m}-${d}_${hh}${mm}${ss}`;
    const filename = `data_${timestamp}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function enabledStartButton(){
    document.getElementById("start-btn").disabled = false;
    document.getElementById("end-btn").disabled = true;
}

function disabledStartButton(){
    document.getElementById("start-btn").disabled = true;
    document.getElementById("end-btn").disabled = false;
}