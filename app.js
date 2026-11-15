(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};

  // 1. 用配置覆盖页面上的文本字段
  document.querySelectorAll("[data-field]").forEach(function (el) {
    var key = el.getAttribute("data-field");
    if (cfg[key] !== undefined && cfg[key] !== null && cfg[key] !== "") {
      el.textContent = cfg[key];
    }
  });

  if (cfg.productName) {
    document.title = cfg.productName + " — " + (cfg.tagline || "产品介绍");
  }
  if (cfg.description) {
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", cfg.description);
  }

  // 2. 轻提示
  var toast = document.getElementById("toast");
  var toastTimer;
  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 3600);
  }

  // 3. 下载按钮：有链接则跳转，否则明确提示，避免死链
  document.querySelectorAll("[data-download]").forEach(function (link) {
    var isIOS = link.getAttribute("data-download") === "ios";
    var url = isIOS ? cfg.iosUrl : cfg.androidUrl;
    if (url) {
      link.setAttribute("href", url);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.setAttribute("href", "#download");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        notify("下载链接尚未配置：请在 config.js 中填写 " + (isIOS ? "iosUrl" : "androidUrl") + "。");
      });
    }
  });

  // 4. 二维码：配置图片则替换示意图案
  if (cfg.qrImage) {
    var qrBox = document.getElementById("qr-code");
    if (qrBox) {
      var img = document.createElement("img");
      img.src = cfg.qrImage;
      img.alt = "应用下载二维码";
      qrBox.replaceChildren(img);
      qrBox.classList.add("has-image");
    }
  }

  // 5. 联系与隐私政策链接
  var emailLink = document.querySelector("[data-link='email']");
  if (emailLink) {
    if (cfg.contactEmail) {
      emailLink.setAttribute("href", "mailto:" + cfg.contactEmail);
    } else {
      emailLink.addEventListener("click", function (event) {
        event.preventDefault();
        notify("联系邮箱尚未配置：请在 config.js 中填写 contactEmail。");
      });
    }
  }

  var privacyLink = document.querySelector("[data-link='privacy']");
  if (privacyLink) {
    if (cfg.privacyUrl) {
      privacyLink.setAttribute("href", cfg.privacyUrl);
    } else {
      privacyLink.addEventListener("click", function (event) {
        event.preventDefault();
        notify("隐私政策页面尚未配置：请在 config.js 中填写 privacyUrl。");
      });
    }
  }

  var icp = document.getElementById("icp-number");
  if (icp && cfg.icpNumber) {
    icp.textContent = cfg.icpNumber;
    icp.hidden = false;
  }

  // 6. 版权年份
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // 7. 滚动淡入（尊重系统的减少动效设置）
  var revealItems = document.querySelectorAll(".reveal");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (el) { el.classList.add("in"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(function (el) { observer.observe(el); });
  }
})();
