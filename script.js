const display = document.querySelector("#display");
const expression = document.querySelector("#expression");
const keys = document.querySelector(".keys");

const symbols = { add: "+", subtract: "−", multiply: "×", divide: "÷" };

let current = "0";
let storedValue = null;
let operator = null;
let waitingForNumber = false;
let finished = false;

function parseValue(value) {
    return Number(value.replace(",", "."));
}

function cleanResult(value) {
    if (!Number.isFinite(value)) return "Erro";
    const rounded = Number.parseFloat(value.toPrecision(12));
    return String(rounded).replace(".", ",");
}

function updateDisplay() {
    display.textContent = current;
    expression.textContent = storedValue !== null && operator
        ? `${cleanResult(storedValue)} ${symbols[operator]}`
        : "\u00a0";

    document.querySelectorAll("[data-operator]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.operator === operator && waitingForNumber);
    });
}

function reset() {
    current = "0";
    storedValue = null;
    operator = null;
    waitingForNumber = false;
    finished = false;
    updateDisplay();
}

function inputNumber(number) {
    if (current === "Erro" || waitingForNumber || finished) {
        current = number;
        waitingForNumber = false;
        finished = false;
    } else if (current === "0") {
        current = number;
    } else if (current.length < 15) {
        current += number;
    }
    updateDisplay();
}

function inputDecimal() {
    if (current === "Erro" || waitingForNumber || finished) {
        current = "0,";
        waitingForNumber = false;
        finished = false;
    } else if (!current.includes(",")) {
        current += ",";
    }
    updateDisplay();
}

function operate(left, right, selectedOperator) {
    switch (selectedOperator) {
        case "add": return left + right;
        case "subtract": return left - right;
        case "multiply": return left * right;
        case "divide": return right === 0 ? NaN : left / right;
        default: return right;
    }
}

function chooseOperator(nextOperator) {
    if (current === "Erro") return reset();
    const value = parseValue(current);

    if (operator && !waitingForNumber) {
        storedValue = operate(storedValue, value, operator);
        current = cleanResult(storedValue);
        if (current === "Erro") {
            operator = null;
            storedValue = null;
            return updateDisplay();
        }
    } else if (storedValue === null || finished) {
        storedValue = value;
    }

    operator = nextOperator;
    waitingForNumber = true;
    finished = false;
    updateDisplay();
}

function calculate() {
    if (!operator || waitingForNumber || current === "Erro") return;
    const previousExpression = `${cleanResult(storedValue)} ${symbols[operator]} ${current} =`;
    current = cleanResult(operate(storedValue, parseValue(current), operator));
    storedValue = null;
    operator = null;
    waitingForNumber = false;
    finished = true;
    updateDisplay();
    expression.textContent = previousExpression;
}

function runAction(action) {
    if (action === "clear") return reset();

    if (action === "clear-entry") {
        current = "0";
        finished = false;
    } else if (action === "backspace") {
        if (current === "Erro" || finished) current = "0";
        else current = current.length > 1 ? current.slice(0, -1) : "0";
        if (current === "-") current = "0";
    } else if (action === "sign" && current !== "0" && current !== "Erro") {
        current = current.startsWith("-") ? current.slice(1) : `-${current}`;
    } else if (action === "percent" && current !== "Erro") {
        current = cleanResult(parseValue(current) / 100);
    } else if (action === "decimal") {
        return inputDecimal();
    } else if (action === "calculate") {
        return calculate();
    }
    updateDisplay();
}

keys.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.number) inputNumber(button.dataset.number);
    else if (button.dataset.operator) chooseOperator(button.dataset.operator);
    else runAction(button.dataset.action);
});

const keyboardMap = {
    "+": "[data-operator='add']",
    "-": "[data-operator='subtract']",
    "*": "[data-operator='multiply']",
    "/": "[data-operator='divide']",
    "%": "[data-action='percent']",
    ".": "[data-action='decimal']",
    ",": "[data-action='decimal']",
    Enter: "[data-action='calculate']",
    "=": "[data-action='calculate']",
    Backspace: "[data-action='backspace']",
    Escape: "[data-action='clear']",
    Delete: "[data-action='clear-entry']"
};

document.addEventListener("keydown", (event) => {
    const selector = /^\d$/.test(event.key)
        ? `[data-number='${event.key}']`
        : keyboardMap[event.key];
    if (!selector) return;

    event.preventDefault();
    const button = document.querySelector(selector);
    button.click();
    button.classList.add("is-pressed");
    setTimeout(() => button.classList.remove("is-pressed"), 100);
});

updateDisplay();
