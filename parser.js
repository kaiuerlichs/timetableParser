// Set colour constants
const CYN = "\x1b[36m"
const RST = "\x1b[0m"

// Function to get number of days in a month
function daysInMonth (month, year) {
    return new Date(year, month, 0).getDate();
}

// Function to generate request URL
function composeUrl(sid, tcode, week){
    return "https://timetable.dundee.ac.uk:8085/reporting/textspreadsheet?objectclass=student+set&idtype=id&identifier="+sid+"/"+tcode+"&t=SWSCUST+student+set+individual&days=1-7&weeks="+week+"&periods=1-28&template=SWSCUST+student+set+textspreadsheet"
}

// Import required modules
try {
    const ics = require('ics')
    const prompt = require("prompt-sync")
    const axios = require("axios")
    const cheerio = require("cheerio")
}
catch {
    console.log(CYN+"[ WARN ]"+RST+" Please run 'npm install ics prompt-sync axios cheerio' to install dependencies...")
    return
}
const ics = require("ics")
const prompt = require("prompt-sync")({sigint: true})
const axios = require("axios")
const cheerio = require("cheerio")
const { writeFileSync } = require('fs')

console.log(CYN+"\n▀█▀ █ █▀▄▀█ █▀▀ ▀█▀ ▄▀█ █▄▄ █   █▀▀   ▀█▀ █▀█   █▀▀ ▄▀█ █   █▀▀ █▄ █ █▀▄ ▄▀█ █▀█")
console.log(" █  █ █ ▀ █ ██▄  █  █▀█ █▄█ █▄▄ ██▄    █  █▄█   █▄▄ █▀█ █▄▄ ██▄ █ ▀█ █▄▀ █▀█ █▀▄\n"+RST)

console.log("This tool allows you to parse your UoD timetable and create an .ics file, to import into your calendar application.\n")

console.log(CYN+"To generate the Semester 2 timetable calendar, simply enter your Student ID and press Enter on any other parameters."+RST)

console.log("\nIf an error occured, or you want to adjust the generation parameters, visit your timetable on evision and inspect the URL...")
console.log("\nLocate the identifier parameter: "+CYN+"identifier=1234567/1"+RST+" => Student ID is 1234567, Timetable Code is 1")
console.log("(In most cases, the Timetable Code is 1, but if the script failed to run, it might be different for you.)")

console.log("\nLocate the weeks parameter: "+CYN+"weeks=28-38"+RST+" => Start Week is 28, End Week is 38")
console.log("(These week numbers do not correspond to the semester week numbers, so make sure to double check.)\n")

// Get user info
let studentId = prompt(CYN+"[ INPUT ]"+RST+" Student ID (this is required): ")
let timetableCode = prompt(CYN+"[ INPUT ]"+RST+" Timetable Code (Press Enter for default): ", "1")
let startWeek = prompt(CYN+"[ INPUT ]"+RST+" Start Week: (Press Enter for SEM2 default)", "28")
let endWeek = prompt(CYN+"[ INPUT ]"+RST+" End week: (Press Enter for SEM2 default)", "38")

generateCalendar()

async function generateCalendar(){
    // Generate calendar
    let events = []

    for(i = Number(startWeek); i <= Number(endWeek); i++){
        let url = composeUrl(studentId, timetableCode, i)
        let response = await axios.get(url, { timeout: 10000 })
        let $ = cheerio.load(response.data)
        
        let dateString = $('span').filter(function() {
            return $(this).text().trim() === 'Weeks:';
        }).next().next().next().text().split(/,|\//);

        let startDay = Number(dateString[0])
        let startMonth = Number(dateString[1])
        let startYear = Number(dateString[2]) + 2000

        let currentDay = startDay
        let currentMonth = startMonth
        let currentYear = startYear

        $("table[class=spreadsheet]").each((i, table) => {
            $(table).find("tr").not(".columnTitles").each((j, row) => {
                const td = $(row).find("td")
                var online = false
                if($(td[8]).text().includes("Online") || $(td[8]).text().includes("online")){
                    online = true
                }

                let description = "Module Code: " + $(td[0]).text().match(/(\w+)/g)[0].trim() + "\nStaff: " + $(td[7]).text().replace(/\s+/g, ' ').trim()
                let htmlContent = "<b>Module Code: </b>" + $(td[0]).text().match(/(\w+)/g)[0].trim() + "<br><b>Staff: </b>" + $(td[7]).text().replace(/\s+/g, ' ').trim()

                let event = {
                    start: [currentYear, currentMonth, currentDay, Number($(td[3]).text().replace(/\s+/g, ' ').trim().split(":")[0]), Number($(td[3]).text().replace(/\s+/g, ' ').trim().split(":")[1])],
                    end: [currentYear, currentMonth, currentDay, Number($(td[4]).text().replace(/\s+/g, ' ').trim().split(":")[0]), Number($(td[4]).text().replace(/\s+/g, ' ').trim().split(":")[1])],
                    status: 'CONFIRMED',
                    busyStatus: 'BUSY',
                    title: "["+$(td[2]).text().replace(/\s+/g, ' ').trim()+"] "+$(td[1]).text().replace(/\s+/g, ' ').trim(),
                    location: $(td[8]).text().replace(/\s+/g, ' ').trim().split("~SEM2- ").join(""),
                    description: description,
                    htmlContent: htmlContent,
                    calName: "Timetable for " + studentId,
                    startInputType: "utc"
                }

                console.log(event)

                events.push(event)
            })

            if(currentDay == daysInMonth(currentMonth, currentYear)){
                if(currentMonth != 12){
                    currentDay = 1;
                    currentMonth += 1
                }
                else{
                    currentDay = 1
                    currentMonth = 1
                    currentYear += 1
                }
            }
            else{
                currentDay += 1
            }
        })
    }
    
    const { error, value } = ics.createEvents(events)
    if (error) {
        console.log(error)
        return
    }

    writeFileSync("./timetable.ics", value)
}

