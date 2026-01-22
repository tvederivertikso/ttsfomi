// =======================================================================
// === ОРИГИНАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ (СОХРАНЕНЫ) ===================
// =======================================================================
const text = document.querySelector('.text')
const pitch = document.querySelector('.pitch')
const pitch_str = document.querySelector('#pitch-str')
const rate = document.querySelector('.rate')
const rate_str = document.querySelector('#rate-str')
const max_threads = document.querySelector('.max-threads')
const max_threads_int = document.querySelector('#max-threads-int')
const mergefiles = document.querySelector('.mergefiles')
const mergefiles_str = document.querySelector('#mergefiles-str')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const settingsButton = document.querySelector('.settingsbutton')
const pointsSelect = document.querySelector('.pointsselect')
const pointsType = document.querySelector('.pointstype')
const textArea = document.getElementById('text-area')
const stat_info = document.querySelector('#stat-info')
const stat_str = document.querySelector('#stat-str')
const fileInput = document.getElementById('file-input')
const dopSettings = document.getElementById('dop-settings-label')
const cbLexxRegister = document.getElementById('lexx_register')

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 4200
var lexx = []
var save_path_handle


// =======================================================================
// === НОВЫЙ БЛОК: ЛОГИКА ОЧЕРЕДИ ФАЙЛОВ =================================
// =======================================================================

// --- Глобальные переменные для очереди ---
let fileQueue = []; // Массив для хранения объектов файлов { id, file, status }
let isQueueProcessing = false; // Флаг, что очередь в процессе обработки

// --- Получаем новые элементы из DOM ---
const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');
const queueContainer = document.getElementById('queue-container');
const clearQueueBtn = document.getElementById('clear-queue-btn');

// --- Назначаем новые обработчики событий ---

browseBtn.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('click', (e) => {
    if (e.target.id === 'drop-zone' || e.target.tagName === 'P') {
        fileInput.click();
    }
});

fileInput.addEventListener('change', (event) => {
    handleFileSelection(event.target.files);
    fileInput.value = '';
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFileSelection(e.dataTransfer.files);
});

clearQueueBtn.addEventListener('click', () => {
    if (isQueueProcessing) {
        alert("Нельзя очистить очередь во время обработки.");
        return;
    }
    fileQueue = [];
    renderQueue();
});

saveButton.addEventListener('click', () => {
    if (fileQueue.length > 0 && !isQueueProcessing) {
        startQueueProcessing();
    } else if (isQueueProcessing) {
        alert("Обработка уже запущена.");
    } else {
        alert("Очередь пуста. Добавьте файлы для обработки.");
    }
});


// --- Функции для управления очередью ---

function handleFileSelection(files) {
    for (const file of files) {
        if (!fileQueue.some(item => item.file.name === file.name && item.file.size === file.size)) {
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            fileQueue.push({ id: fileId, file: file, status: 'queued' });
        }
    }
    renderQueue();
}

function renderQueue() {
    queueContainer.innerHTML = '';
    if (fileQueue.length === 0) {
        queueContainer.innerHTML = '<p style="text-align: center; color: #888;">Очередь пуста</p>';
        return;
    }

    fileQueue.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.id = item.id;
        itemDiv.className = `queue-item status-${item.status}`;
        itemDiv.innerHTML = `
            <span class="file-name" title="${item.file.name}">${item.file.name}</span>
            <span class="file-status">${item.status}</span>
        `;
        queueContainer.appendChild(itemDiv);
    });
}

function updateItemStatus(fileId, newStatus, statusText = newStatus) {
    const itemElement = document.getElementById(fileId);
    if (itemElement) {
        itemElement.className = `queue-item status-${newStatus}`;
        const statusElement = itemElement.querySelector('.file-status');
        if (statusElement) {
            statusElement.textContent = statusText;
        }
    }
}

async function startQueueProcessing() {
    isQueueProcessing = true;
    saveButton.disabled = true;
    clearQueueBtn.disabled = true;
    saveButton.textContent = "Обработка...";
    stat_info.textContent = ""; // Очищаем старое сообщение

    // ...
try {
    // Запрашиваем доступ к папке
    save_path_handle = await window.showDirectoryPicker();

    // === НОВЫЙ КОД: ЗАПРАШИВАЕМ ПОСТОЯННЫЕ РАЗРЕШЕНИЯ ===
    const options = { mode: 'readwrite' };
    // Проверяем, есть ли у нас уже права
    if (await save_path_handle.queryPermission(options) !== 'granted') {
        // Если прав нет, запрашиваем их
        if (await save_path_handle.requestPermission(options) !== 'granted') {
            // Если пользователь отказал, прерываем операцию
            throw new Error('Необходимы права на запись в папку для сохранения файлов.');
        }
    }
    console.log("Права на запись в папку получены.");
    // =================================================

} catch (err) {
    console.log('Ошибка при получении доступа к папке:', err.message);
    isQueueProcessing = false;
    saveButton.disabled = false;
    clearQueueBtn.disabled = false;
    saveButton.textContent = "Начать обработку и сохранить";
    stat_info.textContent = "Ошибка: " + err.message;
    return;
}
// ...


    for (const item of fileQueue) {
        if (item.status === 'completed' || item.status === 'error') {
            continue;
        }

        try {
            updateItemStatus(item.id, 'processing', 'Обработка...');
            await processAndSaveSingleFile(item);
            updateItemStatus(item.id, 'completed', 'Готово');
        } catch (error) {
            console.error(`Ошибка при обработке файла ${item.file.name}:`, error);
            updateItemStatus(item.id, 'error', 'Ошибка');
        }
    }

    isQueueProcessing = false;
    saveButton.disabled = false;
    clearQueueBtn.disabled = false;
    saveButton.textContent = "Начать обработку и сохранить";
    stat_info.textContent = "Очередь завершена!";
    document.getElementById('progress-container').style.display = 'none';
}

async function processAndSaveSingleFile(queueItem) {
    const fileText = await readFileAsText(queueItem.file);
    const currentBook = new ProcessingFile(
        queueItem.file.name.slice(0, queueItem.file.name.lastIndexOf(".")),
        fileText,
        FIRST_STRINGS_SIZE,
        LAST_STRINGS_SIZE,
        lexx,
        cbLexxRegister.checked,
        voice.value,
        rate_str.textContent,
        String(pitch_str.textContent)
    );

    if (!currentBook.all_sentences || currentBook.all_sentences.length === 0) {
        throw new Error("Файл пуст или не удалось извлечь текст.");
    }

    const numThreads = parseInt(max_threads.value, 10) || 5;
    const batchSize = parseInt(mergefiles.value, 10) || 10;
    const sentences = currentBook.all_sentences;
    const totalParts = sentences.length;
    let batchCounter = 1;
    let totalCompleted = 0;

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressText.textContent = `Подготовка...`;

    console.log(`Начинаем обработку файла. Всего частей: ${totalParts}. Размер батча: ${batchSize}. Потоков: ${numThreads}.`);

    for (let i = 0; i < totalParts; i += batchSize) {
        const batch = sentences.slice(i, i + batchSize);
        const batchStartIndex = i;
        
        updateItemStatus(queueItem.id, 'processing', `Обработка батча ${batchCounter}...`);
        console.log(`Начинаем обработку батча №${batchCounter} (части с ${batchStartIndex + 1} по ${batchStartIndex + batch.length})`);

        const audioPartsForBatch = await new Promise((resolve, reject) => {
            const batchResults = new Array(batch.length);
            let running = 0;
            let completedInBatch = 0;
            let taskIndex = 0;

            function runNextTask() {
                if (completedInBatch === batch.length) {
                    resolve(batchResults);
                    return;
                }

                while (running < numThreads && taskIndex < batch.length) {
                    running++;
                    const currentTaskIndexInBatch = taskIndex++;
                    const sentence = batch[currentTaskIndexInBatch];
                    const absoluteIndex = batchStartIndex + currentTaskIndexInBatch;

                    const taskPromise = new Promise((resolveTask, rejectTask) => {
                        const socketTTS = new SocketEdgeTTS_for_Queue(
                            absoluteIndex,
                            (audioData) => resolveTask(audioData),
                            (error) => rejectTask(error)
                        );
                        socketTTS.start_works(
                            currentBook.file_names[0][0],
                            (absoluteIndex + 1).toString().padStart(4, '0'),
                            "Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
                            pitch_str.textContent,
                            rate_str.textContent,
                            "+0%",
                            sentence
                        );
                    });

                    taskPromise
                        .then(audioData => {
                            batchResults[currentTaskIndexInBatch] = audioData;
                        })
                        .catch(error => {
                            reject(error);
                        })
                        .finally(() => {
                            running--;
                            completedInBatch++;
                            totalCompleted++;
                            
                            const percentage = ((totalCompleted / totalParts) * 100).toFixed(1);
                            progressBar.style.width = `${percentage}%`;
                            progressText.textContent = `Синтез... ${totalCompleted} / ${totalParts}`;
                            progressPercentage.textContent = `${percentage}%`;

                            runNextTask();
                        });
                }
            }
            runNextTask();
        });

        updateItemStatus(queueItem.id, 'processing', `Сохранение батча ${batchCounter}...`);
        try {
            let totalLength = 0;
            audioPartsForBatch.forEach(part => { if(part) totalLength += part.length; });

            if (totalLength === 0) {
                console.warn(`Батч №${batchCounter} не сгенерировал аудиоданных. Пропускаем сохранение.`);
                continue;
            }

            const combinedAudio = new Uint8Array(totalLength);
            let offset = 0;
            audioPartsForBatch.forEach(part => {
                if(part) {
                    combinedAudio.set(part, offset);
                    offset += part.length;
                }
            });

            const finalBlob = new Blob([combinedAudio.buffer], { type: 'audio/mp3' });
            
            // ...
            const baseFileName = currentBook.file_names[0][0];
            const sanitizedBaseName = baseFileName.replace(/[\\/:*?"<>|]/g, '_');
            const finalFileName = `${batchCounter.toString().padStart(4, '0')}_${sanitizedBaseName}.mp3`; 
            // ...

            console.log(`Попытка сохранить файл батча: "${finalFileName}"`);
            const fileHandle = await save_path_handle.getFileHandle(finalFileName, { create: true });
            const writableStream = await fileHandle.createWritable();
            await writableStream.write(finalBlob);
            await writableStream.close();
            console.log(`Файл батча "${finalFileName}" успешно сохранен.`);

        } catch (saveError) {
            console.error(`!!! ОШИБКА ПРИ СОХРАНЕНИИ БАТЧА №${batchCounter}:`, saveError);
            throw saveError;
        }

        batchCounter++;
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const fileNameLower = file.name.toLowerCase();
            try {
                if (fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.ini')) {
                    resolve(reader.result);
                } else if (fileNameLower.endsWith('.fb2')) {
                    resolve(convertFb2ToTxt(reader.result));
                } else if (fileNameLower.endsWith('.epub')) {
                    const text = await convertEpubToTxt(file);
                    resolve(text);
                } else if (fileNameLower.endsWith('.zip')) {
                    reject(new Error("ZIP-файлы в режиме очереди пока не поддерживаются."));
                } else {
                    reject(new Error("Неподдерживаемый формат файла."));
                }
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error);

        if (file.name.toLowerCase().endsWith('.epub')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// =======================================================================
// === КЛАСС С ПОВТОРНЫМИ ПОПЫТКАМИ (RETRY) ==============================
// =======================================================================

class SocketEdgeTTS_for_Queue extends SocketEdgeTTS {
    constructor(indexpart, successCallback, errorCallback) {
        super(indexpart, '', '', '', '', '', '', '', null, null, true, true);
        
        this.successCallback = successCallback;
        this.errorCallback = errorCallback;
        this.isFinished = false;
        this.retryCount = 0;
        this.maxRetries = 20; // Увеличено до 20
    }

    onSocketClose() {
        if (this.isFinished) return;

        if (!this.mp3_saved && !this.end_message_received) {
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.warn(`Socket для части ${this.indexpart} закрылся. Попытка переподключения №${this.retryCount}...`);
                
                this.my_uint8Array = new Uint8Array(0);
                this.audios = [];

                setTimeout(() => {
                    this.start_works(this.my_filename, this.my_filenum, this.my_voice, this.my_pitch, this.my_rate, this.my_volume, this.my_text);
                }, 3000);

            } else {
                this.isFinished = true;
                const errorMessage = `Socket для части ${this.indexpart} не удалось подключиться после ${this.maxRetries} попыток.`;
                console.error(errorMessage);
                this.errorCallback(new Error(errorMessage));
            }
        }
    }

    save_mp3() {
        if (this.isFinished) return;
        if (this.my_uint8Array.length > 0) {
            this.mp3_saved = true;
            this.isFinished = true;
            this.successCallback(this.my_uint8Array);
            this.clear();
        } else {
            this.isFinished = true;
            this.errorCallback(new Error(`No audio data received for part ${this.indexpart}`));
        }
    }
    
    start_works(filename, filenum, voice, pitch, rate, volume, text) {
        this.my_filename = filename;
        this.my_filenum = filenum;
        this.my_voice = voice;
        this.my_pitch = pitch;
        this.my_rate = rate;
        this.my_volume = volume;
        this.my_text = text;
        super.start_works();
    }
    
    saveFiles(blob) { /* Пусто */ }
}


// =======================================================================
// === ОРИГИНАЛЬНЫЕ ФУНКЦИИ (СОХРАНЕНЫ) ==================================
// =======================================================================

dopSettings.addEventListener('click', e => change_dopSettings())
settingsButton.addEventListener('click', e => lite_mod())
rate.addEventListener('input', e => rate_str.textContent = rate.value >= 0 ? `+${rate.value}%` : `${rate.value}%`)
pitch.addEventListener('input', e => pitch_str.textContent = pitch.value >= 0 ? `+${pitch.value}Hz` : `${pitch.value}Hz`)
max_threads.addEventListener('input', e => max_threads_int.textContent = max_threads.value)
mergefiles.addEventListener('input', e => mergefiles_str.textContent = mergefiles.value == 100 ? "ВСЕ" : `${mergefiles.value} шт.`)
window.addEventListener('beforeunload', function(event) { save_settings() });

document.addEventListener("DOMContentLoaded", function(event) {
	lite_mod()
	load_settings()
	set_dopSettings()
    renderQueue();
})

function change_dopSettings() {
	if (dopSettings.textContent == "︿") {
		dopSettings.textContent = "﹀"
	} else {
		dopSettings.textContent = "︿"
	}
	set_dopSettings()
}

function set_dopSettings() {
	const display_dop = (textArea.style.display == 'block' || dopSettings.textContent == "︿") ? 'block' : 'none';
	document.querySelector('#div-pitch').style.display = display_dop
	document.querySelector('#div-threads').style.display = display_dop
	document.querySelector('#div-mergefiles').style.display = display_dop
	document.querySelector('#div-lexx_register').style.display = display_dop
}

function lite_mod() {
	const display_str = (textArea.style.display == 'none') ? 'block' : 'none'
	const display_dop = (textArea.style.display == 'none' || dopSettings.textContent == "︿") ? 'block' : 'none';
	textArea.style.display = display_str;
	
	document.querySelector('#div-pitch').style.display = display_dop
	document.querySelector('#div-threads').style.display = display_dop
	document.querySelector('#div-mergefiles').style.display = display_dop
	document.querySelector('#div-lexx_register').style.display = display_dop
	
	if (display_str == 'none') {
		dopSettings.style.display = 'block'
		document.querySelector("section").classList.replace("options", "optionslite")
	} else {
		dopSettings.style.display = 'none'
		document.querySelector("section").classList.replace("optionslite", "options")
	}
}

function points_mod() {
	if (pointsType.innerHTML === "V1") {
		pointsType.innerHTML = "V2";
	} else if (pointsType.innerHTML === "V2") {
		pointsType.innerHTML = "V3";
	} else if (pointsType.innerHTML === "V3") {
		pointsType.innerHTML = "V1";
	}
}

function save_settings() {
	localStorage.setItem('pointsSelect_value'         , pointsSelect.value          )
	localStorage.setItem('pointsType_innerHTML'       , pointsType.innerHTML        )
	localStorage.setItem('voice_value'                , voice.value                 )
	localStorage.setItem('rate_value'                 , rate.value                  )
	localStorage.setItem('pitch_value'                , pitch.value                 )
	localStorage.setItem('max_threads_value'          , max_threads.value           )
	localStorage.setItem('mergefiles_value'           , mergefiles.value            )
	localStorage.setItem('rate_str_textContent'       , rate_str.textContent        )
	localStorage.setItem('pitch_str_textContent'      , pitch_str.textContent       )
	localStorage.setItem('max_threads_int_textContent', max_threads_int.textContent )
	localStorage.setItem('mergefiles_str_textContent' , mergefiles_str.textContent  )
	localStorage.setItem('dopSettings_textContent'    , dopSettings.textContent     )
	localStorage.setItem('cbLexxRegister_checked'     , cbLexxRegister.checked      )
}

function load_settings() {
	if (localStorage.getItem('pointsSelect_value'         )) { pointsSelect.value          = localStorage.getItem('pointsSelect_value'         ) }
	if (localStorage.getItem('pointsType_innerHTML'       )) { pointsType.innerHTML        = localStorage.getItem('pointsType_innerHTML'       ) }
	if (localStorage.getItem('voice_value'                )) { voice.value                 = localStorage.getItem('voice_value'                ) }
	if (localStorage.getItem('rate_value'                 )) { rate.value                  = localStorage.getItem('rate_value'                 ) }
	if (localStorage.getItem('pitch_value'                )) { pitch.value                 = localStorage.getItem('pitch_value'                ) }
	if (localStorage.getItem('max_threads_value'          )) { max_threads.value           = localStorage.getItem('max_threads_value'          ) }
	if (localStorage.getItem('mergefiles_value'           )) { mergefiles.value            = localStorage.getItem('mergefiles_value'           ) }
	if (localStorage.getItem('rate_str_textContent'       )) { rate_str.textContent        = localStorage.getItem('rate_str_textContent'       ) }
	if (localStorage.getItem('pitch_str_textContent'      )) { pitch_str.textContent       = localStorage.getItem('pitch_str_textContent'      ) }
	if (localStorage.getItem('max_threads_int_textContent')) { max_threads_int.textContent = localStorage.getItem('max_threads_int_textContent') }
	if (localStorage.getItem('mergefiles_str_textContent' )) { mergefiles_str.textContent  = localStorage.getItem('mergefiles_str_textContent' ) }
	if (localStorage.getItem('dopSettings_textContent'    )) { dopSettings.textContent     = localStorage.getItem('dopSettings_textContent'    ) }
	if (localStorage.getItem('cbLexxRegister_checked'     )) { cbLexxRegister.checked      = localStorage.getItem('cbLexxRegister_checked'     ) === 'true' }
}
