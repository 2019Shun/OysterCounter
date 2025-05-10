const rowAddTriggers = ["次", "はい", "ハイ"]; // 行追加トリガー単語

let recognition;
let isRecognizing = false;
let currentRowIndex = null;
let processingFlg = 0

let currentMemoIndex = null;
let isMemoMode = false;
let confirmedMemo = '';
let memoStartResultIndex = null;

window.addEventListener("beforeunload", function (event) {
    // ページを離れる際にテーブルにデータがある場合は確認ダイアログを表示する
    if (isExistTableDate()) {
        event.preventDefault();
    }
});

document.addEventListener("click", function (e) {
    if (e.target.classList.contains("memo-icon")) {
        // 音声入力中はメモアイコンをクリックできないように制御
        if (isRecognizing) {
            return
        }
        
        // data-index属性を取得してcurrentMemoIndexに代入
        currentMemoIndex = parseInt(e.target.getAttribute("data-index"));

        // メモモーダルを開く
        openMemoModal()
    }
});

document.getElementById("memo-save").addEventListener("click", () => {
    saveMemo()
});

document.getElementById("memo-cancel").addEventListener("click", () => {
    cancelMemo()
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

        if (!isMemoMode) {
            // 通常モード処理

            // 音声に「終了」が含まれていたら認識停止 & 終了処理
            if (transcript.includes("終了")) {
                recognition.stop();
                stopRecognition(); // 終了ボタン押下時と同じ処理を呼び出す
                return;
            }

            document.getElementById('speech-output').textContent = transcript;

            // 「次」or「はい」→ 行追加
            // 行追加中だったり、入力対象行がNULLの場合は追加しない
            if (!processingFlg && rowAddTriggers.some(trigger => transcript.includes(trigger)) && !isBlankTgtRow()) {
                processingFlg = 1;
                setTimeout(() => {
                    addRow();
                    processingFlg = 0;
                }, 1);
                return;
            }

            // 「メモ」→現在行のメモモーダルを開いて音声入力モードにする
            if (transcript.includes("メモ")) {
                currentMemoIndex = document.getElementById('data-table').getElementsByTagName('tbody')[0].rows.length - 1;
                openMemoModal();
                isMemoMode = true;
                memoStartResultIndex = event.resultIndex;
                return;
            }

            // 「次」or「はい」という単語の前の部分を削除
            // 連続で発話された際に前回値が入力される不具合に対応するため
            const rowAddStringIndex = Math.max(...rowAddTriggers.map(keyword => transcript.lastIndexOf(keyword)))
            const transcriptForMatch = rowAddStringIndex !== -1 ? transcript.slice(rowAddStringIndex) : transcript;

            // 数値の抽出
            const lengthMatches = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(ミリ|ミリメートル|mm)/g);
            const weightMatches = transcriptForMatch.match(/(\d+(?:\.\d+)?)\s*(g|G|グラム)/g);

            if (!processingFlg && (lengthMatches || weightMatches)) {
                const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
                if (currentRowIndex === null) {
                    // 行が存在しなければ追加
                    addRow();
                }

                const rows = table.getElementsByTagName('tr');
                const targetRow = rows[currentRowIndex] || rows[0];
                if (lengthMatches?.length) {
                    targetRow.cells[0].textContent = lengthMatches[lengthMatches.length - 1].match(/\d+(?:\.\d+)?/)[0]; // 長さ
                }
                if (weightMatches?.length) {
                    targetRow.cells[1].textContent = weightMatches[weightMatches.length - 1].match(/\d+(?:\.\d+)?/)[0]; // 重さ
                }
            }

        } else {
            // メモモード処理

            if (transcript.includes("保存")) {
                saveMemo();
                isMemoMode = false;
            }

            if (transcript.includes("キャンセル")) {
                cancelMemo();
                isMemoMode = false;
            }

            // 発言をメモ欄に追加
            // 認識が完了するまでは灰色で表示する
            const input = document.getElementById("memo-input");
            let unconfirmedMemo = ''; // 暫定(灰色)の認識結果
            for (let i = event.resultIndex; i < event.results.length; i++) {
                let tmpTranscript = event.results[i][0].transcript;
                console.log(i)
                console.log(memoStartResultIndex)
                console.log(tmpTranscript)

                // メモモーダルを開いた際の「メモ」という発言は含めない
                if (i <= memoStartResultIndex) {
                    const tmpMemoIndex = tmpTranscript.lastIndexOf("メモ");
                    console.log(tmpMemoIndex)
                    tmpTranscript = tmpMemoIndex !== -1 ? tmpTranscript.slice(tmpMemoIndex + 2) : tmpTranscript;
                }

                // 確定した発言情報とそれ以外を区別して保持する（表示する際は同じスタイル）
                if (event.results[i].isFinal) {
                    confirmedMemo += tmpTranscript;
                } else {
                    unconfirmedMemo = tmpTranscript;
                }
            }
            input.value = confirmedMemo + unconfirmedMemo;
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
        if (!isBlankTgtRow()) {
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

        // 終了した際に入力対象行が空だったらその行を削除する
        const table = document.getElementById("data-table");
        const tbody = table.getElementsByTagName("tbody")[0];
        const rows = tbody.rows;
        if (rows.length > 0) {
            const tgtRow = rows[currentRowIndex] || rows[0];
            const length = tgtRow.cells[0].innerText.trim();
            const weight = tgtRow.cells[1].innerText.trim();
            if (!length && !weight) {
                tbody.deleteRow(0);
            }
        }

        // 1行も入力せず終了した際にダウンロードボタンを非活性にする
        updateDownloadButtonState();

        console.log('音声認識を停止しました');
    }
}

function isBlankTgtRow() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    if (!table.rows.length) {
        return false;
    }
    const rows = table.getElementsByTagName('tr');
    const targetRow = rows[currentRowIndex] || rows[0];
    return !targetRow.cells[0].textContent || !targetRow.cells[1].textContent
}

function isExistTableDate() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    return !!table.rows.length
}

function addRow() {
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];

    // 現在の行数を取得
    const rowIndex = table.rows.length;

    // 先頭に新規行を追加
    const newRow = table.insertRow(0);

    // 長さセル
    const legthCell = newRow.insertCell(0);
    makeCellEditable(legthCell);

    // 重さセル
    const weightCell = newRow.insertCell(1);
    makeCellEditable(weightCell);

    // メモアイコンセル
    const memoCell = newRow.insertCell(2);
    memoCell.innerHTML = `<span class="memo-icon" data-index="${rowIndex}">📝</span>`;

    // 非表示メモデータセル
    const hiddenMemoCell = newRow.insertCell(3);
    hiddenMemoCell.style.display = "none";

    // 新しく追加された行番号を保持
    currentRowIndex = 0;

    // ダウンロードボタンの活性制御
    updateDownloadButtonState();
}

function deleteRow() {
    // 未実装

    // ダウンロードボタンの活性制御
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

function downloadCSV() {
    const table = document.getElementById("data-table");
    let csv = "Length,Weight,Memo\n"; // ヘッダー行

    const tbodyRows = table.tBodies[0].rows;

    for (let row of tbodyRows) {
        const length = row.cells[0].textContent.trim().replace(/[^\d.]/g, "");
        const weight = row.cells[1].textContent.trim().replace(/[^\d.]/g, "");
        const memo = row.cells[3]?.innerText?.replace(/"/g, '""') || "";

        const lengthVal = length || "0";
        const weightVal = weight || "0";

        csv += `${lengthVal},${weightVal},"${memo}"\n`;
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

function openMemoModal() {
    // 現在の行数を取得
    const rowNum = document.getElementById('data-table').getElementsByTagName('tbody')[0].rows.length;

    // 選択された行のメモ情報を取得
    // data-indexは追加された順に採番されるため、そこからテーブル行数の逆数をとることでレコード情報を取得する
    const row = document.querySelector("#data-table tbody").rows[rowNum - currentMemoIndex - 1];
    confirmedMemo = row.cells[3].textContent || "";

    document.getElementById("memo-input").value = confirmedMemo;
    document.getElementById("memo-modal").classList.remove("hidden");
    document.getElementById('overlay').classList.remove('hidden');
}

function saveMemo() {
    const memoText = document.getElementById("memo-input").value;

    // 現在の行数を取得
    const rowNum = document.getElementById('data-table').getElementsByTagName('tbody')[0].rows.length;

    // 入力された内容を隠し要素に格納する
    const row = document.querySelector(`#data-table tbody`).rows[rowNum - currentMemoIndex - 1];
    const hiddenMemoCell = row.cells[3];
    hiddenMemoCell.textContent = memoText;

    const icon = document.querySelector(`.memo-icon[data-index="${currentMemoIndex}"]`);

    // メモアイコンのスタイル変更
    if (memoText.trim()) {
        icon.classList.add("filled");
    } else {
        icon.classList.remove("filled");
    }

    document.getElementById("memo-modal").classList.add("hidden");
    document.getElementById('overlay').classList.add('hidden');
}

function cancelMemo() {
    // キャンセルボタン押下時は入力内容は保存せず、モーダルを閉じる
    document.getElementById("memo-modal").classList.add("hidden");
    document.getElementById('overlay').classList.add('hidden');
}