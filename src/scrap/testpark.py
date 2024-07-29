import csv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from selenium.common.exceptions import NoSuchElementException

visited_urls = set()  # Keep track of visited URLs to prevent an infinite loop
scraped_data = set()  # Keep track of scraped data to avoid repetition

def classify_parking(parking_data):
    name = parking_data["name"].lower()
    operating_hours = parking_data["operating_hours"].lower()
    price = parking_data["price"].lower()

    if any(color in name for color in ["pink", "orange", "yellow", "red"]):
        if "free for residents" in operating_hours:
            return " Paid Parking Zone but Free for Residents"
        elif any(keyword in name for keyword in ["paid", "disc", "resident"]) and "free for residents" in operating_hours:
            return " Paid Parking Zone but Free for Residents"
        elif "disabled" in operating_hours or "dedicated" in operating_hours:
            return " Parking free for People with Reduced Mobility"
        elif "free on sundays and public holidays" in operating_hours:
            return " Paid Parking Zone but Free on Sundays and Public Holidays"
        elif any(keyword in name for keyword in ["paid", "disc", "resident"]):
            return " Parking Fine (for a period)"
        else:
            return " Paid Parking Zone"
    
    elif any(color in name for color in ["blue", "green"]):
        if "free on sundays and public holidays" in operating_hours:
            return " Paid Parking Zone but Free on Sundays and Public Holidays"
        if any(keyword in name for keyword in ["paid", "disc", "resident"]) and ("disabled" in operating_hours or "dedicated" in operating_hours):
            return " Parking free for People with Reduced Mobility"
        elif any(keyword in name for keyword in ["paid", "disc", "resident"]):
            return " Parking Fine (for a period)"
        elif "free for residents" in operating_hours:
            return " Paid Parking Zone but Free for Residents"
        else:
            return " Free Parking Zone"
    
    elif any(color in name for color in ["black", "purple"]):
        if any(keyword in name for keyword in ["paid", "disc", "resident"]):
            return " Parking Fine (for a period)"
        else:
            return " No Parking Zone"

    
    elif "free on sundays and public holidays" in name or "free" in operating_hours:
        return " Free Parking on Sundays and Public Holidays"
    
    elif "free for residents" in operating_hours:
        return " Free Parking Zone for Residents"
    
    else:
        return "Public Parking"


def scrape_parking_info(parking_box):
    parking_info = parking_box.find('div', class_='parkingRules_parkingBoxInfos__JBz4n')

    if parking_info:
        parking_name_element = parking_info.find('b')
        operating_hours_element = parking_info.find_all('small')[0]
        parking_spots_element = parking_info.find_all('small')[1]
        
        # Check if all necessary elements exist
        if all([parking_name_element, operating_hours_element, parking_spots_element]):
            parking_name = parking_name_element.text.strip()
            operating_hours = operating_hours_element.text.strip()
            parking_spots = parking_spots_element.text.strip()
            
            additional_info_link_element = parking_info.find('a', href=True)
            additional_info_link = additional_info_link_element['href'] if additional_info_link_element else "Additional info link not available"

            # Find the span containing the price
            price_span = parking_box.find('span', string=lambda text: '/' in (text or ""))
            price = price_span.text.strip() if price_span else "Price information not available"

            data = (parking_name, operating_hours, parking_spots, additional_info_link, price)
            if data not in scraped_data:
                scraped_data.add(data)
                return {
                    "name": parking_name,
                    "operating_hours": operating_hours,
                    "parking_spots": parking_spots,
                    "additional_info_link": additional_info_link,
                    "price": price
                }
    return None

def save_to_csv(data):
    with open('parking_liege.csv', mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if file.tell() == 0:  # Check if the file is empty
            writer.writerow(['Parking Name', 'Operating Hours', 'Parking Spots', 'Additional Info Link', 'Price', 'Classification'])  # Write title line
        for parking_data in data:
            writer.writerow([parking_data["name"],
                             parking_data["operating_hours"],
                             parking_data["parking_spots"],
                             parking_data["additional_info_link"],
                             parking_data["price"],
                             classify_parking(parking_data)])

def regenerate_page(url):
    global visited_urls  # Access the global variable
    global scraped_data  # Access the global variable
    elements_count = 0
    scraped_data = set()  # Clear scraped data for each regeneration
    
    # Check if the URL has already been visited
    if url in visited_urls:
        print("URL already visited. Exiting.")
        return
    
    # Add the URL to the set of visited URLs
    visited_urls.add(url)
    
    # Initialize a Selenium webdriver
    driver = webdriver.Chrome()  # You'll need to download the appropriate webdriver for your browser
    
    try:
        # Send a GET request to the URL
        driver.get(url)
        
        # Wait for the page to load completely
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, 'parkingRules_parkingsSection___CEZT')))
        
        while True:
            # Parse the HTML content
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            # Find all parking boxes within the section
            parking_boxes = soup.find_all('div', class_='parkingRules_parkingBox__QRvz4')
    
            # Loop through each parking box and extract the data
            parking_data_list = []
            for parking_box in parking_boxes:
                parking_data = scrape_parking_info(parking_box)
                if parking_data:
                    parking_data_list.append(parking_data)
                    elements_count += 1
            
            # Save scraped data to CSV
            save_to_csv(parking_data_list)
            
            try:
                # Check if there is a "Show more" button
                show_more_button = driver.find_element(By.XPATH, "//div[@class='parkingRules_showMoreOrLess__kSXhM']//button[text()='Show more']")
                if show_more_button.is_displayed():
                    # Scroll the "Show more" button into view
                    driver.execute_script("arguments[0].scrollIntoView(true);", show_more_button)
                    
                    # Click the "Show more" button using JavaScript
                    driver.execute_script("arguments[0].click();", show_more_button)
                    
                    # Wait for the additional content to load
                    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, 'parkingRules_parkingBox__QRvz4')))
                else:
                    print("No more data to show.")
                    break
            except NoSuchElementException:
                print("No 'Show more' button found.")
                break
                
    except Exception as e:
        print("Error:", e)
    finally:
        driver.quit()  # Close the browser once done
        print("Total elements counted:", elements_count)

# Call the function to regenerate the page
# url = "https://seety.co/parking-rules/brussels" 
url = "https://seety.co/parking-rules/liege"
regenerate_page(url)
