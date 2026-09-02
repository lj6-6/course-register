import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://yajajcnqxdexfumglxow.supabase.co";
const SUPABASE_KEY = "sb_publishable_AcPSpttHTHxg_A0pW1qaTA_86xvoNvD";
const QR_CODE_IMAGE = "wechat-qr.png";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.querySelector("#app");
const nav = document.querySelector("#nav");

let session = null;
let profile = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function accountEmail(username) {
  const bytes = new TextEncoder().encode(username.trim().toLowerCase());
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const text = String.fromCharCode(...hash);
  return `u-${btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}@course-register.invalid`;
}

function route() {
  return location.hash.slice(1) || "home";
}

function go(to) {
  location.hash = to;
}

function errorMessage(error) {
  return escapeHtml(error?.message || "操作失败，请稍后重试。");
}

function money(amount) {
  return `¥${Number(amount).toFixed(2)}`;
}

function statusLabel(status) {
  return {
    waiting_payment: "待付款",
    pending_review: "待确认",
    paid: "已支付",
    rejected: "已拒绝",
  }[status] || "未知";
}

function statusClass(status) {
  return {
    waiting_payment: "wait",
    pending_review: "review",
    paid: "ok",
    rejected: "bad",
  }[status] || "wait";
}

function setNav() {
  if (!session) {
    nav.innerHTML = '<a href="#login">登录</a><a href="#register">注册</a><a href="#admin-login">管理员入口</a>';
    return;
  }
  nav.innerHTML = `<a href="#app">我的登记</a>${profile?.is_admin ? '<a href="#admin">后台</a>' : ""}<button type="button" id="logout">退出</button>`;
  document.querySelector("#logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    session = null;
    profile = null;
    go("home");
  });
}

async function loadProfile() {
  if (!session) {
    profile = null;
    return;
  }
  const { data, error } = await supabase.from("profiles").select("id, name, username, special_number, is_admin").eq("id", session.user.id).single();
  if (error) throw error;
  profile = data;
}

function showMessage(kind, text) {
  return `<div class="${kind}">${escapeHtml(text)}</div>`;
}

function buttonLoading(button, loading) {
  button.disabled = loading;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = "处理中...";
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
}

function renderGate() {
  app.innerHTML = `
    <div class="gate">
      <div class="gate-box">
        <h1>你是否有课程学习登记需求？</h1>
        <div class="gate-buttons">
          <button class="btn yes-btn" id="yes-btn">Yes</button>
          <button class="btn no-btn" id="no-btn">No</button>
        </div>
      </div>
    </div>`;
  const yes = document.querySelector("#yes-btn");
  const no = document.querySelector("#no-btn");
  let noCount = 0;
  no.addEventListener("click", () => {
    noCount += 1;
    no.style.transform = `scale(${Math.max(.45, 1 - noCount * .12)})`;
    yes.style.transform = `scale(${Math.min(1.55, 1 + noCount * .12)})`;
  });
  yes.addEventListener("click", () => go(session ? "app" : "register"));
}

function renderRegister() {
  app.innerHTML = `
    <section>
      <h1>注册账号</h1>
      <form id="register-form" class="grid two">
        <div><label for="name">姓名</label><input id="name" name="name" autocomplete="name" maxlength="40" required></div>
        <div><label for="username">用户名</label><input id="username" name="username" autocomplete="username" maxlength="40" required></div>
        <div><label for="special-number">特殊数字</label><input id="special-number" name="specialNumber" maxlength="40" required></div>
        <div><label for="password">密码</label><input id="password" type="password" name="password" autocomplete="new-password" minlength="6" required></div>
        <div><label for="confirm-password">确认密码</label><input id="confirm-password" type="password" name="confirmPassword" autocomplete="new-password" minlength="6" required></div>
        <div class="row"><button class="btn btn-primary" type="submit">创建账号</button></div>
      </form>
      <div id="form-message" class="hidden"></div>
    </section>`;
  document.querySelector("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    const username = form.get("username").trim();
    const specialNumber = form.get("specialNumber").trim();
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");
    const message = document.querySelector("#form-message");
    const button = event.currentTarget.querySelector("button");
    if (!name || !username || !specialNumber || !password) {
      message.className = "error";
      message.textContent = "请把所有内容填完整。";
      return;
    }
    if (password !== confirmPassword) {
      message.className = "error";
      message.textContent = "两次密码不一致。";
      return;
    }
    buttonLoading(button, true);
    const { data, error } = await supabase.auth.signUp({
      email: await accountEmail(username),
      password,
      options: { data: { name, username, special_number: specialNumber } },
    });
    buttonLoading(button, false);
    if (error) {
      message.className = "error";
      message.innerHTML = errorMessage(error);
      return;
    }
    if (!data.session) {
      message.className = "notice";
      message.textContent = "账号已创建。请在 Supabase 后台关闭邮箱确认后再登录。";
      return;
    }
    session = data.session;
    await loadProfile();
    go("app");
  });
}

function renderLogin(isAdminLogin = false) {
  app.innerHTML = `
    <section>
      <h1>${isAdminLogin ? "后台登录" : "登录"}</h1>
      <form id="login-form" class="grid two">
        <div><label for="username">用户名</label><input id="username" name="username" autocomplete="username" maxlength="40" required></div>
        <div><label for="password">密码</label><input id="password" type="password" name="password" autocomplete="current-password" required></div>
        <div class="row"><button class="btn btn-primary" type="submit">${isAdminLogin ? "进入后台" : "登录"}</button>${isAdminLogin ? '<a class="btn btn-muted" href="#login">普通登录</a>' : '<a class="btn btn-muted" href="#register">去注册</a>'}</div>
      </form>
      <div id="form-message" class="hidden"></div>
    </section>`;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = form.get("username").trim();
    const button = event.currentTarget.querySelector("button");
    const message = document.querySelector("#form-message");
    buttonLoading(button, true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: await accountEmail(username),
      password: form.get("password"),
    });
    buttonLoading(button, false);
    if (error) {
      message.className = "error";
      message.innerHTML = errorMessage(error);
      return;
    }
    session = data.session;
    try {
      await loadProfile();
    } catch (profileError) {
      await supabase.auth.signOut();
      session = null;
      message.className = "error";
      message.innerHTML = errorMessage(profileError);
      return;
    }
    if (isAdminLogin && !profile.is_admin) {
      await supabase.auth.signOut();
      session = null;
      profile = null;
      message.className = "error";
      message.textContent = "这个账号没有后台权限。";
      return;
    }
    go(isAdminLogin ? "admin" : "app");
  });
}

function courseRows() {
  return `<div class="course-row" data-course-row>
    <div><label>课程名称</label><input name="courseName" maxlength="100" placeholder="可写简称" required></div>
    <button class="btn btn-muted" type="button" data-remove-course>删除</button>
  </div>`;
}

async function userRegistrations() {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, course_count, exam_count, amount, payment_status, created_at, registration_courses(course_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function paymentBox(registration) {
  if (!registration) return '<p class="hint">你还没有登记过。</p>';
  const action = registration.payment_status === "waiting_payment"
    ? `<button class="btn btn-primary" type="button" data-paid="${registration.id}">我已付款</button>`
    : "";
  const qr = QR_CODE_IMAGE
    ? `<img src="${escapeHtml(QR_CODE_IMAGE)}" alt="微信收款码">`
    : "微信收款码";
  return `<div class="grid two">
    <div class="summary">
      <div><strong>课程数：</strong>${registration.course_count}</div>
      <div><strong>考试数：</strong>${registration.exam_count}</div>
      <div><strong>金额：</strong>${money(registration.amount)}</div>
      <div><strong>状态：</strong><span class="pill ${statusClass(registration.payment_status)}">${statusLabel(registration.payment_status)}</span></div>
      ${action}
    </div>
    <div><div class="qr">${qr}</div></div>
  </div>`;
}

function historyTable(registrations) {
  if (!registrations.length) return '<p class="hint">暂无记录。</p>';
  return `<div class="table-wrap"><table><thead><tr><th>时间</th><th>课程</th><th>考试数</th><th>金额</th><th>状态</th></tr></thead><tbody>${registrations.map((item) => `
    <tr><td>${new Date(item.created_at).toLocaleString("zh-CN")}</td><td>${item.registration_courses.map((course) => escapeHtml(course.course_name)).join("<br>")}</td><td>${item.exam_count}</td><td>${money(item.amount)}</td><td><span class="pill ${statusClass(item.payment_status)}">${statusLabel(item.payment_status)}</span></td></tr>`).join("")}</tbody></table></div>`;
}

async function renderApp() {
  if (!session) {
    go("login");
    return;
  }
  app.innerHTML = '<section><p class="hint">正在加载...</p></section>';
  try {
    const registrations = await userRegistrations();
    app.innerHTML = `
      <section><h1>我的登记</h1><div class="grid three"><div><strong>姓名</strong><div>${escapeHtml(profile.name)}</div></div><div><strong>用户名</strong><div>${escapeHtml(profile.username)}</div></div><div><strong>特殊数字</strong><div>${escapeHtml(profile.special_number)}</div></div></div></section>
      <section><h2>新增登记</h2><form id="registration-form"><div id="course-rows">${courseRows()}</div><div class="row"><button class="btn btn-muted" type="button" id="add-course">添加课程</button></div><div style="max-width:360px"><label for="exam-count">考试个数</label><input id="exam-count" name="examCount" type="number" min="0" max="100" step="1" value="0" required></div><div class="row" style="margin-top:14px"><button class="btn btn-primary" type="submit">提交登记</button></div></form><div id="registration-message" class="hidden"></div></section>
      <section><h2>最近一笔</h2>${paymentBox(registrations[0])}</section>
      <section><h2>我的历史记录</h2>${historyTable(registrations)}</section>`;
    bindRegistrationForm();
    bindPaymentButton();
  } catch (error) {
    app.innerHTML = `<section>${showMessage("error", error.message)}</section>`;
  }
}

function bindRegistrationForm() {
  const rows = document.querySelector("#course-rows");
  const addCourse = document.querySelector("#add-course");
  const renumber = () => rows.querySelectorAll("[data-course-row]").forEach((row, index) => {
    row.querySelector("label").textContent = `课程名称 ${index + 1}`;
  });
  const bindRemove = () => rows.querySelectorAll("[data-remove-course]").forEach((button) => {
    button.onclick = () => {
      if (rows.querySelectorAll("[data-course-row]").length > 1) button.closest("[data-course-row]").remove();
      renumber();
    };
  });
  addCourse.addEventListener("click", () => {
    rows.insertAdjacentHTML("beforeend", courseRows());
    bindRemove();
    renumber();
  });
  bindRemove();
  renumber();
  document.querySelector("#registration-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const courses = form.getAll("courseName").map((value) => value.trim()).filter(Boolean);
    const examCount = Number(form.get("examCount"));
    const message = document.querySelector("#registration-message");
    const button = event.currentTarget.querySelector("button[type=submit]");
    if (!courses.length || !Number.isInteger(examCount) || examCount < 0) {
      message.className = "error";
      message.textContent = "请正确填写课程和考试个数。";
      return;
    }
    buttonLoading(button, true);
    const { error } = await supabase.rpc("create_registration", { course_names: courses, input_exam_count: examCount });
    buttonLoading(button, false);
    if (error) {
      message.className = "error";
      message.innerHTML = errorMessage(error);
      return;
    }
    await renderApp();
  });
}

function bindPaymentButton() {
  const button = document.querySelector("[data-paid]");
  if (!button) return;
  button.addEventListener("click", async () => {
    buttonLoading(button, true);
    const { error } = await supabase.rpc("mark_payment_submitted", { registration_id_input: button.dataset.paid });
    if (error) {
      buttonLoading(button, false);
      alert(error.message);
      return;
    }
    app.innerHTML = `<section><h1>已提交</h1><p>你可退出该网站，随后会通知你。</p><a class="btn btn-primary" href="#app">返回我的登记</a></section>`;
  });
}

async function adminRegistrations() {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, course_count, exam_count, amount, payment_status, created_at, profiles(name, username, special_number), registration_courses(course_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function adminProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, username, special_number, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function renderAdmin() {
  if (!session || !profile?.is_admin) {
    go("admin-login");
    return;
  }
  app.innerHTML = '<section><p class="hint">正在加载...</p></section>';
  try {
    const [registrations, users] = await Promise.all([adminRegistrations(), adminProfiles()]);
    app.innerHTML = `<section><h1>后台管理</h1></section><section><h2>用户列表</h2>${users.length ? `<div class="table-wrap"><table><thead><tr><th>姓名</th><th>用户名</th><th>特殊数字</th><th>注册时间</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.special_number)}</td><td>${new Date(user.created_at).toLocaleString("zh-CN")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">暂无用户。</p>'}</section><section><h2>登记记录</h2>${registrations.length ? `<div class="table-wrap"><table><thead><tr><th>用户</th><th>课程</th><th>考试</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>${registrations.map((item) => `<tr><td>${escapeHtml(item.profiles.name)}<br><span class="tiny">${escapeHtml(item.profiles.username)} / ${escapeHtml(item.profiles.special_number)}</span></td><td>${item.registration_courses.map((course) => escapeHtml(course.course_name)).join("<br>")}</td><td>${item.exam_count}</td><td>${money(item.amount)}</td><td><span class="pill ${statusClass(item.payment_status)}">${statusLabel(item.payment_status)}</span></td><td>${item.payment_status === "pending_review" ? `<div class="row"><button class="btn btn-primary" data-status="paid" data-id="${item.id}">设为已支付</button><button class="btn btn-danger" data-status="rejected" data-id="${item.id}">拒绝</button></div>` : '<span class="tiny">无需操作</span>'}</td></tr>`).join("")}</tbody></table></div>` : '<p class="hint">暂无登记。</p>'}</section>`;
    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        buttonLoading(button, true);
        const { error } = await supabase.from("registrations").update({ payment_status: button.dataset.status }).eq("id", button.dataset.id);
        if (error) {
          buttonLoading(button, false);
          alert(error.message);
          return;
        }
        await renderAdmin();
      });
    });
  } catch (error) {
    app.innerHTML = `<section>${showMessage("error", error.message)}</section>`;
  }
}

async function render() {
  setNav();
  const currentRoute = route();
  if (currentRoute === "home") renderGate();
  else if (currentRoute === "register") renderRegister();
  else if (currentRoute === "login") renderLogin();
  else if (currentRoute === "admin-login") renderLogin(true);
  else if (currentRoute === "app") await renderApp();
  else if (currentRoute === "admin") await renderAdmin();
  else go("home");
}

async function start() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) {
    try {
      await loadProfile();
    } catch (error) {
      await supabase.auth.signOut();
      session = null;
      profile = null;
    }
  }
  await render();
}

window.addEventListener("hashchange", render);
supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  if (!session) profile = null;
});
start();
