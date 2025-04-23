let recognition;
let isRecognizing = false;
let lastCommand = '';
let currentRowIndex = null;
let processingFlg = 0

window.addEventListener("beforeunload", function (event) {
    // ページを離れる際にテーブルにデータがある場合は確認ダイアログを表示する
    if (isExistTableDate()) {
        event.preventDefault();
    }
});

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
        const transcript = event.results[event.results.length - 1][0].transcript;

        // 音声に「終了」が含まれていたら認識停止 & 終了処理
        if (transcript.includes("終了")) {
            recognition.stop();
            stopRecognition(); // 終了ボタン押下時と同じ処理を呼び出す
            return;
        }

        document.getElementById('speech-output').textContent = transcript;

        // 「次」→ 行追加
        if (!processingFlg && transcript.includes("次") && !isBlankLastRow()) {
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
        const cmMatches = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(cm|CM|センチ)/g);
        const gMatches = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(g|G|グラム)/g);

        if (!processingFlg && (cmMatches || gMatches)) {
            const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
            if (currentRowIndex === null) {
                // 行が存在しなければ追加
                addRow();
            }

            const rows = table.getElementsByTagName('tr');
            const targetRow = rows[currentRowIndex] || rows[rows.length - 1];
            if (cmMatches?.length) {
                targetRow.cells[0].textContent = cmMatches[cmMatches.length - 1].match(/\d+(?:\.\d+)?/)[0]; // 長さ
            }
            if (gMatches?.length) {
                targetRow.cells[1].textContent = gMatches[gMatches.length - 1].match(/\d+(?:\.\d+)?/)[0]; // 重さ
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
        document.getElementById('speech-output').textContent = ""
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
        if (!isBlankLastRow()) {
            // 末尾行が空欄でない場合、新規行を追加
            addRow();
        }
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
    if (!table.rows.length) {
        return false;
    }
    const rows = table.getElementsByTagName('tr');
    const targetRow = rows[currentRowIndex] || rows[rows.length - 1];
    return !targetRow.cells[0].textContent || !targetRow.cells[1].textContent
}

function isExistTableDate() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    return !!table.rows.length
}

function addRow() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();
    const cell1 = newRow.insertCell(0);
    const cell2 = newRow.insertCell(1);
    makeCellEditable(cell1);
    makeCellEditable(cell2);
    currentRowIndex = table.rows.length - 1; // 新しく追加された行を対象に
    updateDownloadButtonState();
}

function deleteRow() {
    // 未実装
    updateDownloadButtonState();
}

function makeCellEditable(cell) {
    cell.contentEditable = true;

    // 編集終了時にバリデーション
    cell.addEventListener("blur", function () {
        const value = cell.innerText.trim();

        // 半角数値（小数もOK）にマッチするか確認
        if (!/^\d+(\.\d+)?$/.test(value)) {
            alert("半角数字のみ入力できます");
            cell.innerText = ""; // または以前の値に戻すよう保存しておいても可
        }
    });

    // 入力中に制限かけたいなら以下も追加
    cell.addEventListener("input", function () {
        const value = cell.innerText;
        if (/[^0-9.]/.test(value)) {
            cell.innerText = value.replace(/[^0-9.]/g, "");
            // カーソルを末尾に置く（整形時に必要）
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(cell);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
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

function enabledStartButton() {
    document.getElementById("start-btn").disabled = false;
    document.getElementById("end-btn").disabled = true;
}

function disabledStartButton() {
    document.getElementById("start-btn").disabled = true;
    document.getElementById("end-btn").disabled = false;
}

function updateDownloadButtonState() {
    // ダウンロードボタンの制御関数
    const table = document.getElementById("data-table");
    const downloadBtn = document.getElementById("download-btn");
    const dataRowCount = table.getElementsByTagName("tbody")[0].rows.length;
    downloadBtn.disabled = dataRowCount === 0;
}