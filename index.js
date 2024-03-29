const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const http = require('http').createServer(app);
const Chart = require('chart.js');

// preliminary actions
const examNames = fs.readFileSync(path.join(__dirname, '/public/exams.txt'), 'utf8').split("\n").map(e => e.replace(/[\n\r]/g, ''));
const formattedNames = examNames.map(e => [e.replace(/[\n\r]/g, ''), e.replace(/[\n\r]/g, '').split(' ').join('+')]);

// set the view engine to ejs
app.set('view engine', 'ejs');

// remap views
app.set('views', path.join(__dirname, '/public/views'));

// accessing images
app.use(express.static(__dirname + "/public"));

app.get('/', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');
    
    let mostPopularExam = await getMostPopularExam();
    let mostPopularExamScoreArray = await getExamData(mostPopularExam);
    let mostPopularCount = sampleSize(mostPopularExamScoreArray);
    let mostPopularAverage = getAverageScore(mostPopularExamScoreArray);

    res.render('pages/main.ejs', {
        exams: formattedNames,
        mostPopularExamScoreArray: mostPopularExamScoreArray,
        mostPopularName: mostPopularExam,
        mostPopularCount: mostPopularCount,
        mostPopularAverage: mostPopularAverage
    });
});

app.get('/about', (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');

    res.render('pages/about.ejs', {
        exams: formattedNames
    });
});

app.get('/data', (req, res) => {
	res.set('Cache-Control', 'public, max-age=25200');

	res.status(200).sendFile(path.join(__dirname, 'public/scores.csv'))
})

app.get("/compare", (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');

    res.status(200).render("pages/compare.ejs", {
        exams: formattedNames
    });
})

app.get("/compare/*", async (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');

    let exams = req.url.substring(1).split('++');
    if(exams[exams.length - 1] == '') exams.pop();
    let n = exams.length;
    exams[0] = exams[0].substring(8); // get rid of the /compare

    // examdata item format: [name, avg, pass rate, number of 5s, number of test-takers]
    const nData = 5; // number of relevant stat categories, as shown above
    examdata = [new Array(nData).fill('n/a'), new Array(nData).fill('n/a'), new Array(nData).fill('n/a')]

    // put exam names into examdata
    let i = 0
    exams.forEach((exam) => {
        examdata[i][0] = exam.split('+').join(' ');
        i++
    });

    scoreArrays = []
    i = 0;
    for(let exam of exams){
        scoreArrays.push(await getExamData(decodeURI(exam.split('+').join('%20'))));
        examdata[i][1] = getAverageScore(scoreArrays[i]);
        examdata[i][2] = String(getPassRate(scoreArrays[i])) + '%';
        examdata[i][3] = scoreArrays[i][4];
        examdata[i][4] = sampleSize(scoreArrays[i]);
        if(examdata[i][4] == 0){
            examdata[i][1] = 'n/a';
            examdata[i][2] = 'n/a';
            examdata[i][3] = 'n/a';
        }
        i++;
    }

    console.log(examdata);
    

    res.status(200).render("pages/compare2.ejs", {
        exams: formattedNames,
        exam1data: examdata[0],
        exam2data: examdata[1],
        exam3data: examdata[2]
    });
})

app.get("/*", async (req, res) => {
	res.set('Cache-Control', 'public, max-age=25200');
    let exam = decodeURI(req.url.substring(1).split('+').join('%20'));
    let scoreArray = await getExamData(exam);
    let count = sampleSize(scoreArray);
    let average = getAverageScore(scoreArray);

    if(!examNames.includes(exam)){
        res.render('pages/404.ejs',{
            exams: formattedNames
        });
    }else if(count != 0){
        res.render('pages/class.ejs', {
            exam: exam,
            exams: formattedNames,
            scoreArray: scoreArray,
            count: count,
            average: average
        });
    }else if (count == 0){
        res.render('pages/zero.ejs',{
            exam: exam,
            exams: formattedNames
        });
    }
});

const server = http.listen(process.env.PORT || 8080, () => {
    const port = server.address().port;
    console.log(`App listening at http://localhost:${port}`);
});

//returns a 2-d array of length n where n is the number of years of data available
//to-do: calculate number of available years within function
async function getExamData(examName){
    var years = [];
    var scoresData = [];
    let i = -1;

    return new Promise((res) => {
        fs.createReadStream('public/scores.csv').pipe(csv())
        .on('data', (row) => {
            if(!years.includes(parseInt(row.Year))){
                years.push(parseInt(row.Year));
                scoresData.push([0, 0, 0, 0, 0]);
                i++;
            }
            if(row.Subject.localeCompare(examName) == 0){
                scoresData[i][0] += parseInt(row.one);
                scoresData[i][1] += parseInt(row.two);
                scoresData[i][2] += parseInt(row.three);
                scoresData[i][3] += parseInt(row.four);
                scoresData[i][4] += parseInt(row.five);
            }
        })
        .on('end', () => {
            res(summedArray(scoresData));
        });
    });
}

//is given an array of arrays with length 5, returns singular array with respective indices summed
function summedArray(arr){
    let returnedArray = [0, 0, 0, 0, 0];

    arr.forEach(year => {
        returnedArray[0] += year[0];
        returnedArray[1] += year[1];
        returnedArray[2] += year[2];
        returnedArray[3] += year[3];
        returnedArray[4] += year[4];
    });

    return returnedArray;
}

//sums all values in a 1d array
function sampleSize(arr){
    let total = 0;
    arr.forEach(x => total += x);
    return total;
}

//weighted average of array based on indices
function getAverageScore(arr){
    return Math.round(100 * (1 * arr[0] + 2 * arr[1] + 3 * arr[2] + 4 * arr[3] + 5 * arr[4]) / sampleSize(arr))/100;
}

//percentage of 3s, 4s, and 5s
function getPassRate(arr){
    return Math.trunc(((arr[2] + arr[3] + arr[4]) / sampleSize(arr)) * 10000) / 100;
}

async function getMostPopularExam() {
    var examData = await Promise.all(formattedNames.map(async e => [e[0], await getExamData(e[0])]));

    let highest = -1;
    let examName = '';

    for (var exam of examData) {
        var scores = exam[1];
        if (sampleSize(scores) > highest) {
            highest = sampleSize(scores);
            examName = exam[0];
        }
    }

    return examName;
}