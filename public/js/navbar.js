// document.querySelector('.menu').addEventListener('click', () => {
//     document.querySelectorAll('.target').forEach((item) => {
//         item.classList.toggle('change')
//     })
// })

const menu = document.querySelector('.menu')
const navbar = document.querySelector('.navbar')

menu.addEventListener('click', () => {
    navbar.classList.toggle('change')
    menu.classList.toggle('change')
})