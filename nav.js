/* ハンバーガーメニュー開閉（fx.jsのCDN依存とは独立して動く） */
document.addEventListener('DOMContentLoaded', function () {
  var header = document.querySelector('header');
  var burger = document.querySelector('.nav-burger');
  if (!header || !burger) return;

  burger.addEventListener('click', function () {
    var open = header.classList.toggle('nav-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // リンクを押したらメニューを閉じる
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      header.classList.remove('nav-open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
});
