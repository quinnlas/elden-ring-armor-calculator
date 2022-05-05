const fs = require('fs').promises
const Papa = require('papaparse')
const _ = require('lodash')
const util = require('util')

// INPUT
// the max weight of the armor, you can adjust this for a fast, medium, fat roll as desired
// easiest way is to equip your loadout, remove all armor, and take the difference of the max load you want
const FREE_WEIGHT = 26.12
// which stats you use in the calcScore function
// used for "OR"-ing armor pieces together to greatly decrease number of possible combinations
// Wgt will automatically be included
// all [ 'Phy', 'VS Strike', 'VS Slash', 'VS Pierce', 'Mag', 'Fir', 'Lit', 'Hol', 'Immunity', 'Robustness', 'Focus', 'Vitality', 'Poise']
// defense [ 'Phy', 'VS Strike', 'VS Slash', 'VS Pierce', 'Mag', 'Fir', 'Lit', 'Hol', 'Poise']
// physical ['Phy', 'VS Strike', 'VS Slash', 'VS Pierce', 'Poise']
// malenia ['Phy', 'VS Slash']
const MEASURED_STATS = [ 'Phy', 'VS Strike', 'VS Slash', 'VS Pierce', 'Mag', 'Fir', 'Poise']
const CHECK_AVAILABILITY = true
// you should also edit the calcScore function based on what you are trying to maximize

// CONSTANTS
// fields that may or may not be part of the score
// aside from Wgt, if they are not included in MEASURED_STATS, they will be removed
// so Name and Unavailable would not be included
const POSSIBLE_STATS = [ 'Phy', 'VS Strike', 'VS Slash', 'VS Pierce', 'Mag', 'Fir', 'Lit', 'Hol', 'Immunity', 'Robustness', 'Focus', 'Vitality', 'Poise', 'Wgt' ]

// GLOBALS
let types
let typeOptions = {}

async function main() {
  // LOAD DATA
  const dataFiles = (await fs.readdir('data')).filter(f => f[0] !== '.')
  types = dataFiles.map(f => f.split('.')[0])
  for (const type of types) {
    typeOptions[type] = await getTypeOptions(type)
  }
  const upperBound = types.reduce((p, type) => p * typeOptions[type].length, 1)

  console.log(`Upper bound: ${upperBound} combinations`)

  const best = calcBest(FREE_WEIGHT)
  console.log(`Checked ${best.checked} armor combinations. The best were/was:`)
  best.combinations.forEach(c => {
    console.log(c.map(a => a.Name))
  })
  // console.log('\nDetails:')
  // console.log(util.inspect(best, { depth: null, colors: true }))
}

// recursively calculate the best combinations of armor
// returns the best combinations and their score
// as well as how many combinations were possible (checked)
// { combinations, score, checked }
function calcBest(weight, typeIndex = 0, combination = []) {
  const type = types[typeIndex]
  // base case
  if (!type) {
    return {
      score: calcScore(combination),
      combinations: [combination],
      checked: 1
    }
  }

  const options = typeOptions[type]
    .filter(o => o.Wgt <= weight)

  // determine highest scoring option
  let bestCombinations = []
  let highestScore = 0
  let totalChecked = 0
  for (const option of options) {
    const {
      combinations: bestCombinationsForOption,
      score: optionScore,
      checked
    } = calcBest(weight - option.Wgt, typeIndex + 1, [...combination, option])
    totalChecked += checked
    if (typeIndex === 0) console.log(totalChecked)

    if (optionScore === highestScore) {
      bestCombinations.push(...bestCombinationsForOption)
    } else if (optionScore > highestScore) {
      highestScore = optionScore
      bestCombinations = bestCombinationsForOption
    }
  }

  return {
    score: highestScore,
    combinations: bestCombinations,
    checked: totalChecked
  }
}

// one time calculations for armor pieces
function addVirtualStats(armor) {
  armor.virtualScore = MEASURED_STATS.map(stat => armor[stat])
    .reduce((sum, val) => sum + val)
}

// given a combination of armor pieces, return a value for its score, where higher is better
// since calcScore could run millions of times, minimize it as much as possible
// try to avoid creating new arrays (eg by using "map") or doing calculations that repeat
// (use addVirtualStats for calculations that only need to be done once per piece)
function calcScore(combination) {
  return combination
    .reduce((sum, armor) => sum + armor.virtualScore, 0)
}

async function getTypeOptions(type) {
  const fileStr = await fs.readFile(`data/${type}.csv`, 'utf8')
  const parseResult = Papa.parse(fileStr, {
    header: true,
    dynamicTyping: true
  })

  let options = parseResult.data
  
  // do any filtering we can here to minimize doing it in the recursion
  options = options
    .filter(o => o.Wgt <= FREE_WEIGHT)
    .filter(o => !CHECK_AVAILABILITY || !o.Unavailable)

  // add "nothing" option
  const nothingOption = _.cloneDeep(options[0])
  nothingOption.Name = '(Nothing)'
  for (const key in nothingOption) {
    if (typeof nothingOption[key] === 'number') nothingOption[key] = 0
  }
  options.push(nothingOption)

  // collapse equivalent options
  // this makes it much faster and also makes the output way more readable
  const relevantStats = ['Wgt', ...MEASURED_STATS]
  const groupedOptions = _.groupBy(options, o => relevantStats.map(s => o[s]).join(','))

  // remove unnecessary stats for readability
  const irrelevantStats = _.difference(POSSIBLE_STATS, relevantStats)
  
  return Object.values(groupedOptions).map(group => {
    // create a single piece of armor from a list of equivalent pieces
    let result = group[0]
    
    // join the names to indicate to the user the possible options
    result.Name = group.map(o => o.Name).join(' OR ')

    // remove the irrelevant stats to shorten output
    result = _.omit(result, ...irrelevantStats)

    // add virtual stats (things to calculate once per armor piece to save time in calcScore function)
    addVirtualStats(result)

    return result
  })
}

main().catch(console.error)