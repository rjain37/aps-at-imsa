const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const http = require('http').createServer(app);
const Chart = require('chart.js');

// preliminary actions
const examNames = fs.readFileSync(path.join(__dirname, '/exams.txt'), 'utf8').split("\n");
const formattedNames = examNames.map(c => [c.replace(/[\n\r]/g, ''), c.replace(/[\n\r]/g, '').split(' ').join('+')]);

const scoreLabels = [1, 2, 3, 4, 5];

// set the view engine to ejs
app.set('view engine', 'ejs');

// accessing images
app.use(express.static(__dirname + "/public"));

app.get('/', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');
    
    var mostPopularExam = await getMostPopularExam();
    var mostPopularExamScoreArray = await getExamData(mostPopularExam);
    var mostPopularCount = sampleSize(mostPopularExamScoreArray);
    var mostPopularAverage = getAverageScore(mostPopularExamScoreArray);

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

app.get("/*", async (req, res) => {
	res.set('Cache-Control', 'public, max-age=25200');
    var exam = decodeURI(req.url.substring(1).split('+').join('%20'));

    var scoreArray = await getExamData(exam);
    var count = sampleSize(scoreArray);
    var average = getAverageScore(scoreArray);
    if(count != 0){
        res.render('pages/class.ejs', {
            exam: exam,
            exams: formattedNames,
            scoreArray: scoreArray,
            count: count,
            average: average
        });
    }else if (count == 0){
        res.render('pages/zero.ejs',{
            exams: formattedNames
        });
    }
});

app.get('/data', (req, res) => {
	res.set('Cache-Control', 'public, max-age=25200');

	res.status(200).sendFile(path.join(__dirname, '/scores.csv'))
})

app.get("/error", (req, res) => {
    res.set('Cache-Control', 'public, max-age=25200');

    res.status(404).render("pages/404.ejs");
})

const server = http.listen(8080, () => {
    const port = server.address().port;
    console.log(`App listening at http://localhost:${port}`);
});

async function getExamData(examName){
    var years = [];
    var scoresData = [];
    let i = -1;

    return new Promise((res) => {
        fs.createReadStream('scores.csv').pipe(csv())
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

function sampleSize(arr){
    let total = 0;
    arr.forEach(x => total += x);
    return total;
}

function getAverageScore(arr){
    return Math.round(100 * (1 * arr[0] + 2 * arr[1] + 3 * arr[2] + 4 * arr[3] + 5 * arr[4]) / sampleSize(arr))/100;
}

async function getMostPopularExam(){
    let highest = -1;
    let examName = '';
    return new Promise(async (res) => {
        formattedNames.forEach(async exam => {
            var scores = await getExamData(exam[0]);
            if(sampleSize(scores) > highest){
                highest = sampleSize(scores);
                console.log(exam[0]);
                examName = exam[0];
            }
        });
        res(examName);
    });
}

async function getMostPopularExam () {
    var examData = await Promise.all(formattedNames.map(async exam => [exam[0], await getExamData(exam[0])]));

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