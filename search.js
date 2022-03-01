import "dotenv/config";
import { Client } from "@notionhq/client";
import util from "util";

const notion = new Client({ auth: process.env.NOTION_KEY });

const checkIfSprintTableAlreadyExists = async (latestSprint) => {
  console.log(latestSprint);
  const response = await notion.search({
    query: latestSprint,
    sort: {
      direction: "ascending",
      timestamp: "last_edited_time",
    },
  });

  if (response.results.length) {
    console.log(response.results[0].url);
    console.log(
      `${latestSprint} exists. Exactracting information and creating the sprint entry now.`
    );
    return true;
    // return {
    //   Sprint: {
    //     title: [
    //       {
    //         text: {
    //           content: latestSprint,
    //         },
    //       },
    //     ],
    //   },
    //   sprintURL: {
    //     type: "rich_text",
    //     rich_text: [
    //       {
    //         text: {
    //           content: response.results[0].url,
    //         },
    //       },
    //     ],
    //   },
    // };
  } else {
    console.log(`${latestSprint} DOES NOT exist`);
    return false;
  }
};

const addNewSprintEntry = async (sprintEntry) => {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_BIG_TARGET_DATABASE_ID,
      },
      properties: sprintEntry,
    });
    console.log(util.inspect(response, false, null, true /* enable colors */));
    console.log("Success! Sprint Full Table Entry added.");
  } catch (error) {
    console.error(error);
  }
};

const createSprintTheFunction = async () => {
  const sprintEntry = await checkIfSprintTableAlreadyExists("WW08 (2022)");
  console.log("i am in addNewSprint functino");
  await addNewSprintEntry(sprintEntry);
};

createSprintTheFunction();
