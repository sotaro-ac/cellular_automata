"use strict";

// HTML Elements' IDs
const elmContId = 'container';
const elmLoopsId = 'loops';
const elmCanvasId = 'canvas';
const elmBtnId = 'btn';

// Params
const BASE = 10;    // BASE*BASE
const N = 5 * BASE; // N*N
let U = 8;
let D = 6;

const RADIUS = 3;
const UNDER = 1;    // <= RADIUS
const MIN_MOV = 1;
const LOCALITY = 0.90;
const MIN_THICK = Math.floor(U / 2);

let MAX_STEP = 5000;
const WAIT_MS = 0;  // ms

let cmap = chroma.scale(['whitesmoke', 'green']).domain([0, U]);
let times = 0;


// すべてのセル
let cell = (new Array(N)).fill(0);
cell.forEach((_, i) => {
    cell[i] = (new Array(N)).fill(0);
});

// 前回選ばれたセル
let prev = new Array(2).fill(NaN); // Math.floor(N / 2)

// 原形質が存在する/したことのあるセル
let proto = {};

// 連想配列の要素数
const objLength = (obj) => Object.keys(obj).length;

// sleep()関数
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

// Numberプロパティに右詰めメソッドを追加
Number.prototype.format = function (char, cnt) {
    return (Array(cnt).fill(char).join("") + this.valueOf()).substr(-1 * cnt);
}

// 原形質のある座標を座標配列axisArrからランダムに１つ選ぶ
const selectRand = ([...axisArr]) => {
    if (axisArr.length != 0) {
        // 原形質が見つかるまで座標配列中をランダムに探索する
        while (true) {
            const idx = Math.round(Math.random() * axisArr.length);
            if (axisArr[idx]) return { idx: idx, axis: axisArr[idx] };
        }
    } else {
        // 配列の要素数が0ならnullを返す
        return null;
    }
};

// 座標[y,x](自身は除く)のノイマン近傍radius以内の座標配列を取得する
const getNeighbors = (y, x, radius, filter = true) => {
    let axisArr = [];
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            const LEN = Math.abs(i) + Math.abs(j);
            if (UNDER <= LEN && LEN <= radius)
                axisArr.push([i + y, j + x]);
        }
    }
    // 表示範囲外のセルを削除する
    if (filter) {
        axisArr = axisArr.filter(
            c => (0 <= c[0] && c[0] < N && 0 <= c[1] && c[1] < N)
        );
    }
    return axisArr;
};

// 原形質の連続性を検証
const isContinuous = (y, x) => {
    let checked = {};
    let target = {};

    // 連続性の検証を開始するセル
    if (typeof (y && x) == 'number') {
        target[String([y, x])] = [y, x];
    } else {
        // 検証開始セルの指定がない場合
        const [a, b] = Object.values(proto)[0];
        target[String([a, b])] = [a, b];
    }

    // targetが空になるまで繰り返す
    while (Object.keys(target).length) {
        for (const key in target) {
            const [p, q] = target[key];
            if (cell[p][q]) {
                checked[key] = [p, q];
                const nb = getNeighbors(p, q, 1);
                nb.forEach((el, i) => {
                    const idx = String(el);
                    if (!checked[idx]) target[idx] = el;
                });
            }
            delete target[key];
        }
    }

    // すべての原形質が連続であればtrueを返す
    if (objLength(checked) == objLength(proto)) {
        return true;
    } else {
        return false;
    }
};

// 初期化
const init = () => {
    document.getElementById("step").value = MAX_STEP;
    document.getElementById("upperLimit").value = U;
    document.getElementById("difference").value = D;

    let s = Math.floor((N - BASE) / 2);
    let e = Math.ceil((N + BASE) / 2);

    // 各値を0に初期化
    times = 0;
    proto = {};
    cell.forEach((el, _) => { el.fill(0); });

    // 中央領域に原形質を設置する
    for (let i = s; i < e; i++) {
        for (let j = s; j < e; j++) {
            // 値を設定：MIN_THICK <= cell[i][j] <= U
            cell[i][j] = Math.round(Math.random() * (U - MIN_THICK)) + MIN_THICK;
            // 原形質が存在する(値が0ではない)セルをprotoに登録する
            if (cell[i][j]) proto[String([i, j])] = [i, j];
        }
    }

    // 前回選ばれたセルの初値を原形質の中からランダムに決める
    prev = selectRand(Object.values(proto)).axis;
};

// パラメータの再設定
const resetParams = () => {
    const maxStep = document.getElementById("step");
    const uppLim = document.getElementById("upperLimit");
    const differ = document.getElementById("difference");

    // 次のループ回数
    if (!maxStep.value) {
        MAX_STEP = 0;   // '' 空文字の場合
        maxStep.value = 0;
    } else {
        MAX_STEP = Number(maxStep.value);
    }

    // 原形質の上限値
    if (uppLim.value <= 0) {
        uppLim.value = U; // value == '' or value <= 0
    } else {
        U = Number(uppLim.value);
    }

    // 原形質間で移動可能となる差
    if (differ.value <= 0) {
        differ.value = D; // value == '' or value <= 0
    } else {
        D = Number(differ.value);
    }
}

// canvasの描写
function draw(time = times, high_quarity = false) {
    const canvas = document.getElementById(elmCanvasId);
    const ctx = canvas.getContext('2d');

    const stdLen = Math.min(canvas.clientWidth, window.innerHeight - 200);
    // canvas.style.width = stdLen + "px";
    // canvas.style.height = stdLen + "px";

    // メモリ上における実際のサイズを設定(ピクセル密度の分だけ倍増する)
    let scale = 1; // CSS解像度と物理解像度の比
    if (high_quarity) {
        scale = window.devicePixelRatio;
    }
    canvas.width = stdLen * scale;
    canvas.height = stdLen * scale;

    // CSS上のピクセル数を前提としているシステムに合わせる
    ctx.scale(scale, scale);
    let size = stdLen / N;

    // セルの描写
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            let [r, g, b] = cmap(cell[i][j]).rgb();
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            // fillRect(開始x座標, 開始y座標, 描画幅, 描画高さ)
            ctx.fillRect(j * size, i * size, size, size);
        }
    }

    // 補足情報テキストの描写
    ctx.font = `bold ${2 * size}px 'VT323', cursive`;
    ctx.fillStyle = "#000";
    ctx.fillText(`u = ${U} | d = ${D}`, size, 2 * size);
    ctx.fillText(`t = ${time}`, size, 4.25 * size);
}

// セルの状態を更新
function step() {
    /**
     * 前回選ばれた原形質の近傍RADIUS以内の原形質を
     * LOCALITYの確率で選択する
     * */
    let y, x;
    if (Math.random() < LOCALITY) {
        [y, x] = selectRand(getNeighbors(...prev, RADIUS)).axis;
    } else {
        [y, x] = selectRand(Object.values(proto)).axis;
    }

    // 今回選ばれたセルの座標を記録
    if (cell[y][x]) prev = [y, x];

    // 今回選ばれた原形質と隣接するセルの座標配列
    const nb = getNeighbors(y, x, 1);

    // 今回選ばれた原形質と隣接するセルを１つランダムに選ぶ
    const dest = Math.floor(Math.random() * nb.length);
    const [p, q] = nb[dest];  // 選ばれたセルの座標
    const v = cell[y][x];     // 移動元のセルの値
    const w = cell[p][q];     // 移動先のセルの値

    /**
     * 以下の条件をを満たすとき値の移動が可能
     * ・移動元の値が0より大きい
     * ・移動先の値がUより小さい
     * ・セル間の差がDより大きい
     * */

    // 条件を満たさない場合を判定
    if (v <= 0 || U <= w || D < Math.abs(w - v)) {
        // 値の移動が発生しない場合はfalseを返す
        return false;
    }

    // 移動元から移動先へMIN_MOVだけ値を移動する
    [cell[y][x], cell[p][q]] = [v - MIN_MOV, w + MIN_MOV];

    // 移動先の値がMIN_MOVであればprotoに登録する
    if (cell[p][q] == MIN_MOV) proto[String([p, q])] = [p, q];

    // 移動元の値が0であればprotoから削除する
    // 移動元の値が0になったときに連続性のチェックが行われる
    if (cell[y][x] == 0) {
        delete proto[String([y, x])];
        // 値の移動後に原形質が連続しない場合はロールバックする
        if (!isContinuous()) {
            [cell[y][x], cell[p][q]] = [v, w];
            if (cell[p][q] == 0) delete proto[String([p, q])];
            if (cell[y][x] == MIN_MOV) proto[String([y, x])] = [y, x];
            return false;
        }
    }

    // console.log(`[${[y, x]}(${cell[y][x]})]-(${MIN_MOV})->[${[p, q]}(${cell[y][x]})]`);

    return true;    // 値の移動が発生した場合はtrueを返す
}

async function run() {
    const counter = document.getElementById(elmLoopsId);
    const elmbtn = document.getElementById(elmBtnId);
    elmbtn.disabled = true;
    elmbtn.textContent = "RUNNING...";
    let t = 0;
    while (t < MAX_STEP) {
        if (step()) {
            // requestAnimationFrame(()=>draw(t + times + 1));
            draw(t + times + 1);
            counter.textContent = `loop: ${++t + times} [times]`;
            await sleep(WAIT_MS);
        }
    }
    times = times + t;
    draw(times, true);  // 高画質のcanvasを描写
    elmbtn.disabled = false;
    elmbtn.textContent = "CONTINUE";
}

window.onload = () => {
    const elmbtn = document.getElementById(elmBtnId);
    init();
    draw(times, true);
    // クリックイベントを登録
    elmbtn.onclick = () => {
        resetParams();
        run();
    };
}
