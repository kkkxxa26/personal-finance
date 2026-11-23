
console.log("Personal Finance запущен!");

// =========================
// ACCOUNTS
// =========================

const accounts = {
    optima: 80000,
    simbaCredit: 6000,
    simbaPersonal: 40000
};

// =========================
// HTML ELEMENTS
// =========================

const expenseForm = document.getElementById("expense-form");
const expenseDate = document.getElementById("expense-date");

const optimaElement = document.getElementById("optima-balance");
const simbaCreditElement = document.getElementById("simba-credit-balance");
const simbaPersonalElement = document.getElementById("simba-personal-balance");
const totalBalanceElement = document.getElementById("total-balance");

// =========================
// CURRENT DATE
// =========================

const today = new Date();

const formattedDate =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");

expenseDate.value = formattedDate;

// =========================
// UPDATE BALANCES
// =========================


function updateBalances() {

    optimaElement.textContent =
        accounts.optima.toLocaleString("ru-RU") + " сом";

    simbaCreditElement.textContent =
        accounts.simbaCredit.toLocaleString("ru-RU") + " сом";

    simbaPersonalElement.textContent =
        accounts.simbaPersonal.toLocaleString("ru-RU") + " сом";

    const totalBalance =
        accounts.optima +
        accounts.simbaCredit +
        accounts.simbaPersonal;

    totalBalanceElement.textContent =
        totalBalance.toLocaleString("ru-RU") + " сом";
}

// Сразу отображаем начальные балансы
updateBalances();

const transactions = [];

// =========================
// RENDER TRANSACTIONS
// =========================

const transactionsList = document.getElementById("transactions-list");

function renderTransactions() {
    transactionsList.innerHTML = "";

    transactions.forEach(function(transaction) {

        const transactionHTML = `
            <div class="transaction-row">

                <div class="transaction-info">
                    <div class="transaction-icon">
                        ${transaction.icon}
                    </div>

                    <div>
                        <h3>${transaction.title}</h3>
                        <p>${transaction.category} · ${transaction.date}</p>
                    </div>
                </div>

                <span class="transaction-account">
                    ${transaction.account}
                </span>

                <strong class="${transaction.type === "expense" ? "expense" : "income-amount"}">
                    ${transaction.amount.toLocaleString("ru-RU")} сом
                </strong>

            </div>
        `;

        transactionsList.innerHTML += transactionHTML;
    });
}

renderTransactions();


// =========================
// ADD EXPENSE
// =========================


expenseForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // Получаем данные формы
    const amount = Number(
        document.getElementById("expense-amount").value
    );

    const category =
        document.getElementById("expense-category").value;

    const selectedAccount =
        document.getElementById("expense-account").value;

    const date = expenseDate.value;

    // Проверяем заполнение
    if (!Number.isFinite(amount) || amount <= 0 || !category || !selectedAccount || !date) {
        alert("Проверьте заполнение формы");
        return;
    }

    // Определяем счёт
    const accountKeys = {
        optima: "optima",
        "simba-credit": "simbaCredit",
        "simba-personal": "simbaPersonal"
    };

    const accountKey = accountKeys[selectedAccount];

    if (!accountKey) {
        alert("Выбран неизвестный счёт");
        return;
    }

    // Проверяем сумму и баланс
    console.log("Введённая сумма:", amount);
    console.log("Баланс до списания:", accounts[accountKey]);

    if (amount > accounts[accountKey]) {
        alert("Недостаточно средств на выбранном счёте");
        return;
    }

    console.log("Сколько списываем:", amount);

    // Списываем расход
    accounts[accountKey] -= amount;

    console.log("Баланс после списания:", accounts[accountKey]);

    // Обновляем карточки
    updateBalances();

    // Определяем название счёта
    const accountNames = {
        optima: "Optima",
        "simba-credit": "Simba — кредитный",
        "simba-personal": "Simba — личный"
    };

    // Определяем иконку категории
    const categoryIcons = {
        "Продукты": "🛒",
        "Кофе и рестораны": "☕",
        "Транспорт": "🚕",
        "Покупки": "🛍️",
        "Красота и уход": "💄",
        "Другое": "📦"
    };

    // Форматируем дату
    const transactionDate = new Date(date + "T00:00:00");

    const formattedTransactionDate = transactionDate.toLocaleDateString(
        "ru-RU",
        {
            day: "numeric",
            month: "long"
        }
    );

    // Создаём новую транзакцию
    const newTransaction = {
        id: Date.now(),
        title: category,
        category: category,
        amount: -amount,
        account: accountNames[selectedAccount],
        date: formattedTransactionDate,
        icon: categoryIcons[category],
        type: "expense"
    };

    // Добавляем операцию в начало массива
    transactions.unshift(newTransaction);

    // Обновляем историю на странице
    renderTransactions();

    console.log("Новый расход:", newTransaction);


    // Очищаем форму
    expenseForm.reset();
    expenseDate.value = formattedDate;

    alert("Расход успешно добавлен!");
});