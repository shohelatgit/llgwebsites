// FOOTER
const footerYear = document.querySelector("[data-year]")

const currentYear = new Date().getFullYear()

if (footerYear) {
  footerYear.textContent = currentYear
}

// MOBILE MENU
const hamburger = document.querySelector("[data-btn-hamburger]")
const btnCloseMobileMenu = document.querySelector(
  "[data-btn-close-mobile-menu]"
)
const menu = document.querySelector("[data-mobile-menu]")

hamburger.addEventListener("click", () => {
  menu.classList.toggle("hidden")
})

btnCloseMobileMenu.addEventListener("click", () => {
  menu.classList.toggle("hidden")
})

// MOBILE MENU DROPDOWNS
const btnService = document.querySelector("[data-btn-services]")
const servicesIcon = document.querySelector("[data-services-icon]")
const serviceLinks = document.querySelectorAll(".service-link")

btnService.addEventListener("click", () => {
  servicesIcon.classList.toggle("rotate-180")
  serviceLinks.forEach(link => {
    link.classList.toggle("hidden")
    link.classList.toggle("block")
  })
})

const btnLocation = document.querySelector("[data-btn-locations]")
const locationIcon = document.querySelector("[data-locations-icon]")
const locationLinks = document.querySelectorAll(".location-link")

btnLocation.addEventListener("click", () => {
  locationIcon.classList.toggle("rotate-180")
  locationLinks.forEach(link => {
    link.classList.toggle("hidden")
    link.classList.toggle("block")
  })
})

const btnRoofType = document.querySelector("[data-btn-roof-types]")
const roofTypeIcon = document.querySelector("[data-roof-types-icon]")
const roofTypesLinks = document.querySelectorAll(".roof-type-link")

btnRoofType.addEventListener("click", () => {
  roofTypeIcon.classList.toggle("rotate-180")
  roofTypesLinks.forEach(link => {
    link.classList.toggle("hidden")
    link.classList.toggle("block")
  })
})

// FAQ SCRIPT
const questions = document.querySelectorAll("[data-frequent-question]")

if (questions) {
  questions.forEach(question => {
    question.querySelector("button").addEventListener("click", () => {
      question.querySelector(".plus").classList.toggle("hidden")
      question.querySelector(".minus").classList.toggle("hidden")
      question.querySelector("dd").classList.toggle("hidden")
    })
  })
}
